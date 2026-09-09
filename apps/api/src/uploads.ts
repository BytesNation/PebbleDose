import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { eq } from 'drizzle-orm';
import { medications } from '@family/database';
import { DomainError } from './errors';
import type { AuthService } from './domain/auth';
import type { FamilyService } from './domain/service';
export function uploads(
  app: FastifyInstance,
  service: FamilyService,
  auth: AuthService,
  uploadFolder?: string,
) {
  const folder =
    uploadFolder ??
    join(dirname(process.env.DATABASE_PATH ?? './data/medicine.db'), 'images');
  app.register(multipart, {
    limits: { files: 1, fileSize: 2 * 1024 * 1024, fields: 0 },
  });
  app.post('/api/admin/images', async (r, reply) => {
    const actor = auth.actor(r.cookies.family_session);
    if (actor?.role !== 'ADULT')
      throw new DomainError(401, 'Adult sign-in required');
    const file = await r.file();
    if (
      !file ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)
    )
      throw new DomainError(400, 'Choose a JPEG, PNG or WebP image');
    const raw = await file.toBuffer();
    let normalized: Buffer;
    try {
      normalized = await sharp(raw, {
        limitInputPixels: 16000000,
        animated: false,
      })
        .rotate()
        .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new DomainError(400, 'Image could not be decoded safely');
    }
    const filename = `${randomUUID()}.webp`;
    await mkdir(folder, { recursive: true, mode: 0o700 });
    await writeFile(join(folder, filename), normalized, {
      flag: 'wx',
      mode: 0o600,
    });
    service.audit.record(
      actor.id,
      'Medication image uploaded',
      filename,
      service.now(),
    );
    return reply.code(201).send({ url: `/api/images/${filename}` });
  });
  app.get('/api/images/:filename', async (r, reply) => {
    const filename = (r.params as { filename: string }).filename;
    if (!/^[a-f0-9-]{36}\.webp$/.test(filename))
      throw new DomainError(404, 'Image not found');
    const actor = auth.actor(r.cookies.family_session);
    const med = service.store.db
      .select()
      .from(medications)
      .where(eq(medications.image, `/api/images/${filename}`))
      .get();
    if (actor?.role !== 'ADULT') {
      if (!med?.active) throw new DomainError(404, 'Image not found');
      const user = service.user(med.userId);
      if (!user.active || (user.kioskPinRequired && actor?.id !== user.id))
        throw new DomainError(401, 'Unlock this profile first');
    }
    let bytes: Buffer;
    try {
      bytes = await readFile(join(folder, filename));
    } catch {
      throw new DomainError(404, 'Image not found');
    }
    return reply
      .type('image/webp')
      .header('X-Content-Type-Options', 'nosniff')
      .send(bytes);
  });
}
