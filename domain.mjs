export const suppliers = ['Esprinet', 'V-Valley', 'Infortisa', 'Tech Data'];
const rows = [
  ['NB-001','Portátil profesional 14 pulgadas','Portátiles','16 GB RAM · SSD 512 GB · Windows 11 Pro',659,18],
  ['NB-002','Portátil ultraligero 13 pulgadas','Portátiles','16 GB RAM · SSD 1 TB · Pantalla IPS',899,8],
  ['PC-001','Mini PC de oficina','Sobremesa','Core i5 · 16 GB RAM · SSD 512 GB',479,25],
  ['PC-002','Estación de trabajo','Sobremesa','32 GB RAM · SSD 1 TB · Gráfica dedicada',1499,4],
  ['MN-001','Monitor profesional 27 pulgadas','Monitores','QHD · Panel IPS · USB-C 65 W',229,36],
  ['MN-002','Monitor panorámico 34 pulgadas','Monitores','WQHD · Ajuste de altura · USB-C',389,12],
  ['NW-001','Switch gestionable 24 puertos','Redes','Gigabit · PoE+ · Montaje en rack',319,10],
  ['NW-002','Punto de acceso Wi-Fi 6','Redes','Doble banda · Alimentación PoE',119,40],
  ['AC-001','Dock USB-C de escritorio','Accesorios','Doble HDMI · Ethernet · Carga 100 W',89,55],
  ['AC-002','Teclado y ratón inalámbricos','Accesorios','Distribución española · Conexión USB',39,80],
  ['ST-001','NAS de 4 bahías','Almacenamiento','2 conexiones LAN · Discos no incluidos',449,6],
  ['ST-002','Disco SSD empresarial 2 TB','Almacenamiento','NVMe · PCIe 4.0 · Formato M.2',149,0]
];
export const products = rows.map(([id,name,category,description,cost,stock],i)=>({id,name,category,description,offers:suppliers.map((supplier,j)=>({supplier,cost:cost+((j+i)%4)*9,stock:stock?Math.max(0,stock-j*3):0}))}));
export function price(cost, margin) {
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(margin) || margin < 0 || margin >= 100) throw new Error('Coste o margen no válido');
  return Math.round((cost / (1-margin/100) + Number.EPSILON)*100);
}
export function bestOffer(product) { return product.offers.filter(o=>o.stock>0).sort((a,b)=>a.cost-b.cost)[0] ?? null; }
export function catalog(margin) {
  return products.map(({offers,...p})=>{const o=bestOffer({offers});return {...p,stock:o?.stock??0,unitCents:o?price(o.cost,margin):null};});
}
export function makeQuote(items, margin) {
  if (!Array.isArray(items) || !items.length || items.length>100) throw new Error('Añade entre 1 y 100 artículos');
  const seen=new Set();
  const lines=items.map(({id,quantity})=>{
    if(seen.has(id)) throw new Error('Artículo duplicado'); seen.add(id);
    const p=products.find(p=>p.id===id), o=p&&bestOffer(p);
    if(!o || !Number.isInteger(quantity) || quantity<1 || quantity>o.stock) throw new Error('Revisa las cantidades y el stock disponible');
    const supplierOffers=p.offers.map(offer=>({supplier:offer.supplier,costCents:Math.round(offer.cost*100),stock:offer.stock})).sort((a,b)=>a.costCents-b.costCents);
    return {id,name:p.name,quantity,unitCents:price(o.cost,margin),supplier:o.supplier,costCents:Math.round(o.cost*100),supplierOffers};
  });
  const subtotalCents=lines.reduce((s,l)=>s+l.unitCents*l.quantity,0);
  const vatCents=Math.round(subtotalCents*.21);
  return {lines,subtotalCents,vatCents,totalCents:subtotalCents+vatCents,margin};
}
export function publicQuote(q) {
  const {margin,...rest}=q;
  return {...rest,lines:q.lines.map(({id,name,quantity,unitCents})=>({id,name,quantity,unitCents}))};
}
export function purchaseComparison(line) {
  if(!line.supplierOffers) return null;
  const eligible=line.supplierOffers.filter(o=>o.stock>=line.quantity);
  const best=eligible.length?Math.min(...eligible.map(o=>o.costCents)):null;
  return line.supplierOffers.map(o=>({...o,totalCents:o.costCents*line.quantity,best:o.stock>=line.quantity&&o.costCents===best}));
}
export function internalMailText(q) {
  const eur=c=>(c/100).toFixed(2)+' EUR';
  return ['SOLICITUD '+q.id+' · USO INTERNO YMANT','Cliente: '+q.clientName,'Email: '+q.clientEmail,'Fecha: '+q.createdAt,'',...q.lines.flatMap(l=>{
    const offers=purchaseComparison(l);
    return [`${l.quantity} x ${l.id} · ${l.name}`,`Venta al cliente: ${eur(l.unitCents)}/unidad sin IVA`,`Proveedor usado para calcular la venta: ${l.supplier} · ${eur(l.costCents)}/unidad`,...(offers?offers.map(o=>`  ${o.supplier}: ${eur(o.costCents)}/unidad · ${eur(o.totalCents)} para ${l.quantity} uds. · Stock: ${o.stock} · ${o.best?'MEJOR PRECIO CON STOCK SUFICIENTE':o.stock===0?'Sin stock':o.stock<l.quantity?'Stock insuficiente':'Disponible'}`):['Comparativa no registrada en esta solicitud antigua.']),''];
  }),`Base de venta: ${eur(q.subtotalCents)}`,`IVA (21%): ${eur(q.vatCents)}`,`Total de venta: ${eur(q.totalCents)}`,'Costes sin IVA ni portes. Comparativa guardada al crear la solicitud; confirmar disponibilidad antes de comprar.','Comentarios: '+q.notes].join('\r\n');
}
