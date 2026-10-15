const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const compiled=ts.transpileModule(fs.readFileSync('lib/mediaValidation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const media={};new Function('exports',compiled)(media);
test('Marian DNG is rejected with conversion instructions before browser decoding',()=>{
 for(const type of ['', 'image/x-adobe-dng', 'image/jpeg']) {
  const error=media.dressPhotoFormatError({name:'IMG_0669.dng',type});
  assert.match(error,/RAW\/DNG/);assert.match(error,/exporta una copia/);assert.match(error,/solamente la extensión/);
 }
});
test('unsupported HEIC has actionable instructions instead of a generic save error',()=>{
 assert.match(media.dressPhotoFormatError({name:'IMG_1234.heic',type:'image/heic'}),/exportarse primero a JPG/);
});
test('supported JPEG PNG and WebP can proceed to image validation',()=>{
 for(const type of ['image/jpeg','image/png','image/webp'])assert.equal(media.dressPhotoFormatError({name:'foto',type}),null);
});
test('RAW mime cannot bypass validation by changing the file extension',()=>{
 assert.match(media.dressPhotoFormatError({name:'foto.jpg',type:'image/x-adobe-dng'}),/RAW\/DNG/);
});
