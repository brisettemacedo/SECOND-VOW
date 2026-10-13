const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(path,requireFn=require){const compiled=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;const value={};new Function('exports','require',compiled)(value,requireFn);return value;}
const lifecycle=load('lib/orderLifecycle.ts');
const {orderQuickReplies,orderMoneySummary}=lifecycle;
const order={total_mxn:1100,commission_mxn:198,seller_net_mxn:902,paid_at:'2026-09-30T19:34:05Z'};
test('actual refunded order shows 1100 returned and zero seller proceeds',()=>{
 const result=orderMoneySummary({...order,status:'refunded'},[{amount_mxn:1100,status:'refunded'}],[{amount_mxn:902,status:'reversed'}],[{amount_mxn:1100,status:'succeeded'}]);
 assert.equal(result.refunded,1100);assert.equal(result.sellerBalance,0);assert.equal(result.commission,0);
});
test('pending and failed refunds are not represented as returned money',()=>{
 const result=orderMoneySummary({...order,status:'refund_pending'},[],[],[{amount_mxn:1100,status:'processing'},{amount_mxn:1100,status:'failed'}]);
 assert.equal(result.refunded,0);assert.equal(result.refundPending,true);assert.equal(result.sellerBalance,0);
});
test('completed sale retains 18 percent commission and normal seller proceeds',()=>{
 const result=orderMoneySummary({...order,status:'completed'});assert.equal(result.sellerBalance,902);assert.equal(result.commission,198);
});
test('partial refund is distinguished from full refund',()=>{
 const result=orderMoneySummary({...order,status:'paid'},[],[],[{amount_mxn:200,status:'succeeded'}]);assert.equal(result.refunded,200);assert.equal(result.fullRefund,false);
});
test('paid, shipped and disputed orders do not offer shipping quotation or availability replies',()=>{
 for(const status of ['awaiting_payment','paid','preparing_shipment','shipped','inspection','claim_open','return_authorized','return_shipped','returned','refund_pending','refunded','cancelled','completed'])for(const buyer of [true,false]){
  const replies=orderQuickReplies({status},buyer,true);assert.ok(!replies.some(x=>/cotizando|oferta en breve|disponible/.test(x)),status);
 }
});
test('presale still asks for branch destination and allows quotation after receiving it',()=>{
 assert.ok(orderQuickReplies(null,false,false).some(x=>/sucursal/.test(x)));
 assert.ok(orderQuickReplies(null,false,true).some(x=>/cotizando/.test(x)));
});
test('rendered refunded summary does not label 902 as a refund',()=>{
 const component=load('components/AdminOrderRecord.tsx',name=>name==='@/lib/orderLifecycle'?lifecycle:require(name)).default;
 const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(component,{order:{...order,status:'refunded'},payments:[{amount_mxn:1100,status:'refunded'}],payouts:[{amount_mxn:902,status:'reversed'}],refunds:[{amount_mxn:1100,status:'succeeded'}],ledger:[],events:[],adminLogs:[]}));
 assert.match(html,/Reembolso confirmado a la compradora/);assert.match(html,/1,100/);assert.doesNotMatch(html,/902/);assert.match(html,/Saldo de esta venta para la vendedora/);
});
