const API_URL = (window.CONFIG && window.CONFIG.API)
  ? window.CONFIG.API
  : (localStorage.getItem('FERJO_API') || '');

// Asegura que el endpoint apunte a ?path=products si sólo te dieron /exec
function buildProductsUrl() {
  if (!API_URL) return '';
  const hasQuery = API_URL.includes('?');
  const hasPathParam = /[?&]path=/.test(API_URL);
  const base = hasPathParam
    ? API_URL
    : API_URL + (hasQuery ? '&' : '?') + 'path=products';
  // cache buster
  return base + (base.includes('?') ? '&' : '?') + 't=' + Date.now();
}

async function fetchProducts() {
  const url = buildProductsUrl();
  if (!url) {
    throw new Error('No hay API configurada. Define window.CONFIG.API en config.js o usa localStorage.setItem("FERJO_API", "...")');
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo cargar el catálogo');
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

// Normaliza URLs de Drive a un formato embebible en <img>
function normalizeImage(u){
  if(!u) return '';
  u = String(u).trim();

  // /file/d/<id>/view  o  ?id=<id>
  const m = u.match(/\/d\/([a-zA-Z0-9_-]+)/) || u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;

  // export=download -> export=view
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

    const sinStock = (p.cantidad||0) <= 0 || String(p.status||'').toLowerCase() === 'sin_stock';
    node.querySelector('.stock').textContent = sinStock ? 'Sin stock' : `Stock: ${p.cantidad}`;
    node.querySelector('.btn').disabled = sinStock;
    node.querySelector('.btn').addEventListener('click',()=>{
      alert('Demo: aquí podríamos abrir WhatsApp o un formulario de pedido.');
    });

    // Imagen
    const img = node.querySelector('img');
    const rawSrc = p.image_url || p.image_url_2 || p.image_url_3 || '';
    const imgSrc = normalizeImage(rawSrc);

    // Fallback visible y registro de errores
    img.alt = p.nombre || 'Producto FERJO';
    img.loading = 'lazy';
    img.onerror = function(){
      console.warn('Imagen falló:', { id: p.id_del_articulo, nombre: p.nombre, src: imgSrc });
      this.onerror = null;
      this.src = 'https://via.placeholder.com/600x450?text=FERJO';
    };
    img.src = imgSrc || 'https://via.placeholder.com/600x450?text=FERJO';

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
        const hay = (p.nombre||'').toLowerCase().includes(q)
          || (p.id_del_articulo||'').toLowerCase().includes(q)
          || (p.upc_ean_isbn||'').toLowerCase().includes(q);
        const okCat = !cat || (p.categoria||'')===cat;
        return hay && okCat;
      });
      render(list);
    });

    document.getElementById('category').addEventListener('change', (e)=>{
      const cat = e.target.value;
      const q = document.getElementById('search').value.toLowerCase().trim();
      const list = window.__PRODUCTS__.filter(p=> {
        const hay = (p.nombre||'').toLowerCase().includes(q)
          || (p.id_del_articulo||'').toLowerCase().includes(q)
          || (p.upc_ean_isbn||'').toLowerCase().includes(q);
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
