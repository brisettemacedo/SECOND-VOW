const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const compiled=ts.transpileModule(fs.readFileSync('lib/dresses.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const catalog={};new Function('exports',compiled)(catalog);
function client(){
 const calls=[];const q={};
 for(const method of ['select','eq','is','in','gte','lte','order','range'])q[method]=(...args)=>{calls.push([method,...args]);return q;};
 q.then=(resolve)=>Promise.resolve({data:[],count:0,error:null}).then(resolve);
 return {calls,from:()=>q};
}
test('catalog combines advanced filters while retaining public visibility restrictions',async()=>{
 const db=client();await catalog.searchDresses(db,{cola:'capilla,catedral',detalles:'encaje,bordado',sin_ajustes:'1',altura_min:'160',altura_max:'175',ano_min:'2020',ano_max:'2026',sort:'precio-asc',page:'2'});
 const has=(...call)=>db.calls.some(x=>JSON.stringify(x)===JSON.stringify(call));
 assert.ok(has('eq','status','approved'));assert.ok(has('is','removed_by_seller_at',null));
 assert.match(db.calls.find(x=>x[0]==='select')[1],/dress_characteristics!inner/);
 assert.ok(has('in','dress_characteristics.characteristic_id',['encaje','bordado']));
 assert.ok(has('in','cola',['capilla','catedral']));assert.ok(has('eq','tuvo_ajustes',false));
 assert.ok(has('gte','altura_persona_cm',160));assert.ok(has('lte','altura_persona_cm',175));
 assert.ok(has('gte','year_approx',2020));assert.ok(has('lte','year_approx',2026));
 assert.ok(has('order','precio_venta_mxn',{ascending:true}));assert.ok(has('range',24,47));
});
test('unfiltered catalog keeps dresses without characteristics and ignores invalid numbers',async()=>{
 const db=client();await catalog.searchDresses(db,{precio_min:'NaN',altura_min:'-1',ano_min:'Infinity',precio_max:'25000'});
 assert.doesNotMatch(db.calls.find(x=>x[0]==='select')[1],/!inner/);
 assert.deepEqual(db.calls.filter(x=>x[0]==='gte'),[]);
 assert.deepEqual(db.calls.filter(x=>x[0]==='lte'),[['lte','precio_venta_mxn',25000]]);
});
