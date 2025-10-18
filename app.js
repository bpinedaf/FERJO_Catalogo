const API_URL = (window.CONFIG && window.CONFIG.API) 
  ? window.CONFIG.API 
  : (localStorage.getItem('FERJO_API') || '');

async function fetchProducts(){
  if(!API_URL){
    throw new Error('No hay API configurada. Define window.CONFIG.API en config.js o usa localStorage.setItem("FERJO_API", "...")');
  }
  const url = API_URL + (API_URL.includes('?') ? '&' : '?') + 't=' + Date.now();
  const res = await fetch(url);
  if(!res.ok) throw new Error('No se pudo cargar el catálogo');
  const data = await res.json();
  return data.products || [];
}

function formatPrice(n, currency='GTQ'){
  try {
    return new Intl.NumberFormat('es-GT',{style:'currency',currency}).format(n||0);
  } catch {
    return `Q ${Number(n||0).toFixed(2)}`;
  }
}
function normalizeImage(u){
  if(!u) return '';
  u = String(u).trim();

  // Si viene como /file/d/<id>/view o open?id=<id>, conviértelo a uc?export=view&id=<id>
  const m = u.match(/\/d\/([a-zA-Z0-9_-]+)/) || u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;

  // Si es ya uc?export=download, cámbialo por view
  if (/uc\?export=download/i.test(u)) return u.replace('export=download', 'export=view');

  return u;
}

function render(products){
  const grid = document.getElementById('grid');
  const tpl = document.getElementById('card-tpl');
  grid.innerHTML = '';
  products.forEach(p=>{
    const node = tpl.content.cloneNode(true);
    node.querySelector('.name').textContent = p.nombre || '(Sin nombre)';
    node.querySelector('.sku').textContent = `Código: ${p.id_del_articulo || p.upc_ean_isbn || '-'}`;
    node.querySelector('.price').textContent = `Precio: ${formatPrice(p.precio_de_venta, p.moneda)}`;
    const sinStock = (p.cantidad||0) <= 0 || p.status === 'sin_stock';
    node.querySelector('.stock').textContent = sinStock ? 'Sin stock' : `Stock: ${p.cantidad}`;
    node.querySelector('.btn').disabled = sinStock;
    node.querySelector('.btn').addEventListener('click',()=>{
      alert('Demo: aquí podríamos abrir WhatsApp o un formulario de pedido.');
    });
    const img = node.querySelector('img');
    const rawSrc = p.image_url || p.image_url_2 || p.image_url_3 || '';
    const imgSrc = normalizeImage(rawSrc);
    img.src = imgSrc || 'https://via.placeholder.com/600x450?text=FERJO';
    img.alt = p.nombre || 'Producto FERJO';
    // Si falla, cae a placeholder y evita loop
    img.onerror = function(){
      this.onerror = null;
      this.src = 'https://via.placeholder.com/600x450?text=FERJO';
    };
    img.alt = p.nombre || 'Producto FERJO';
    grid.appendChild(node);
  });
}

function hydrateFilters(products){
  const sel = document.getElementById('category');
  const cats = Array.from(new Set(products.map(p=> (p.categoria||'').trim()).filter(Boolean))).sort();
  cats.forEach(c=>{
    const opt = document.createElement('option');
    opt.value=c; opt.textContent=c;
    sel.appendChild(opt);
  });
}

async function main(){
  try {
    const products = await fetchProducts();
    window.__PRODUCTS__ = products;
    hydrateFilters(products);
    render(products);
    // Filtros
    document.getElementById('search').addEventListener('input', (e)=>{
      const q = e.target.value.toLowerCase().trim();
      const cat = document.getElementById('category').value;
      const list = window.__PRODUCTS__.filter(p=> {
        const hay = (p.nombre||'').toLowerCase().includes(q) || (p.id_del_articulo||'').toLowerCase().includes(q) || (p.upc_ean_isbn||'').toLowerCase().includes(q);
        const okCat = !cat || (p.categoria||'')===cat;
        return hay && okCat;
      });
      render(list);
    });
    document.getElementById('category').addEventListener('change', (e)=>{
      const cat = e.target.value;
      const q = document.getElementById('search').value.toLowerCase().trim();
      const list = window.__PRODUCTS__.filter(p=> {
        const hay = (p.nombre||'').toLowerCase().includes(q) || (p.id_del_articulo||'').toLowerCase().includes(q) || (p.upc_ean_isbn||'').toLowerCase().includes(q);
        const okCat = !cat || (p.categoria||'')===cat;
        return hay && okCat;
      });
      render(list);
    });
  } catch (e){
    document.getElementById('grid').innerHTML = '<p>Error cargando productos. Revisa la URL del API en <code>config.js</code> o setea <code>FERJO_API</code> en localStorage.</p>';
    console.error(e);
  }
}

main();
