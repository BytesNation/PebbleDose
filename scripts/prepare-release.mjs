import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const tag = process.env.RELEASE_TAG;
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
if (!/^v\d+\.\d+\.\d+$/.test(tag ?? '') || tag !== `v${version}`) {
  throw new Error(
    'Release tag must match the package version, for example v0.1.0',
  );
}
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const heading = `## [${version}]`;
const start = changelog.indexOf(heading);
if (start < 0) throw new Error('Add a changelog entry before releasing');
const end = changelog.indexOf('\n## ', start + heading.length);
const notes = changelog.slice(start, end < 0 ? undefined : end).trim();
mkdirSync('release-output', { recursive: true });
writeFileSync(
  'release-output/notes.md',
  `${notes}\n\nSource archives include the Docker build and setup instructions. Build locally with Docker Compose. No prebuilt container images are published with this release.\n`,
);
const files = ['tar.gz', 'zip'].map(
  (extension) => `pebbledose-${tag}.${extension}`,
);
for (const name of files) {
  execFileSync('git', [
    'archive',
    '--format=' + (name.endsWith('.zip') ? 'zip' : 'tar.gz'),
    `--prefix=pebbledose-${tag}/`,
    `--output=release-output/${name}`,
    'HEAD',
  ]);
}
writeFileSync(
  'release-output/SHA256SUMS',
  files
    .map(
      (name) =>
        `${createHash('sha256')
          .update(readFileSync(`release-output/${name}`))
          .digest('hex')}  ${name}`,
    )
    .join('\n') + '\n',
);
