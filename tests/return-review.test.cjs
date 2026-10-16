const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const compiled=ts.transpileModule(fs.readFileSync('lib/returnReview.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exportsObject={};new Function('exports',compiled)(exportsObject);
const {returnRefundBlock}=exportsObject;
const now=Date.parse('2026-10-16T22:00:00Z');
const claim={status:'refund_pending',return_tracking_number:'RETURN123',return_reviewed_at:'2026-10-16T21:00:00Z',return_reviewed_by:'admin'};
const resolution={decision:'authorize_return',status:'provisional',appeal_deadline_at:'2026-10-15T22:00:00Z'};
const order={status:'returned',stripe_dispute_status:null};
test('buyer tracking alone never authorizes a refund',()=>assert.ok(returnRefundBlock({...claim,status:'return_shipped',return_reviewed_at:null},resolution,{status:'return_shipped'},now)));
test('seller confirmation or delivered tracking cannot replace administrative verification',()=>assert.match(returnRefundBlock({...claim,return_reviewed_at:null},resolution,order,now),/SECOND VOW debe verificar/));
test('verified return remains blocked during the review window or appeal',()=>{
 assert.ok(returnRefundBlock(claim,{...resolution,appeal_deadline_at:'2026-10-17T22:00:00Z'},order,now));
 assert.ok(returnRefundBlock(claim,{...resolution,status:'appealed'},order,now));
});
test('missing or malformed appeal deadline fails closed',()=>{
 for(const date of [null,'not-a-date'])assert.ok(returnRefundBlock(claim,{...resolution,appeal_deadline_at:date},order,now));
});
test('open chargeback cannot receive a second refund',()=>assert.match(returnRefundBlock(claim,resolution,{...order,stripe_dispute_status:'needs_response'},now),/contracargo/));
test('documented solution after review permits a separate admin refund action',()=>assert.equal(returnRefundBlock(claim,resolution,order,now),null));
test('final appeal decision permits documented resolution without waiting a fresh deadline',()=>assert.equal(returnRefundBlock(claim,{...resolution,status:'final',appeal_deadline_at:'2026-10-19T00:00:00Z'},order,now),null));
test('missing admin identity, tracking or authorized decision blocks payment',()=>{
 assert.ok(returnRefundBlock({...claim,return_reviewed_by:null},resolution,order,now));
 assert.ok(returnRefundBlock({...claim,return_tracking_number:null},resolution,order,now));
 assert.ok(returnRefundBlock(claim,{...resolution,decision:'reject'},order,now));
});
