// Registers any files sitting in data/files/ that were dropped in directly
// (rather than uploaded through the app) so they show up in the CV Library.
// Safe to run any time — already-registered files are skipped.
const { scanForNewDocuments } = require('../server/helpers');

const added = scanForNewDocuments();
if (!added.length) {
  console.log('No new files found in data/files/.');
} else {
  console.log(`Registered ${added.length} new document(s):`);
  for (const d of added) console.log(`  #${d.id}  ${d.label}  (${d.doc_type})`);
  console.log('View them at  http://localhost:3400/cvs');
}
