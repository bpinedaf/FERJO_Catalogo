const API_URL = (window.CONFIG && window.CONFIG.API)
  ? window.CONFIG.API
  : (localStorage.getItem('FERJO_API') || '');

// Asegura endpoint de productos y evita caché CDN
function buildProductsUrl() {
  if (!API_URL) return '';
  const hasQuery = API_URL.includes('?');
  const hasPathParam = /[?&]path=/.test(API_URL);
  const base = hasPathParam
    ? API_URL
    : API_URL + (hasQuery ? '&' : '?') + 'path=products';
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

/* =======================
   IMÁGENES: DRIVE ROBUSTO
   ======================= */

// Extrae el ID de Drive de casi cualquier URL conocida
function extractDriveId(u){
  if(!u) return '';
  u = String(u).trim();
  // .../file/d/<ID>/view
  let m = u.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // ...?id=<ID>
  m = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // ...uc?export=view&id=<ID>
  m = u.match(/uc\?[^#]*id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return '';
}

// Devuelve variantes de URL para un mismo ID de Drive
function driveVariantsFromUrl(u){
  const id = extractDriveId(u);
  if (!id) {
    // Si ya viene un URL http(s) que no es drive, usa tal cual como primera opción
    if (u && /^https?:\/\//i.test(String(u))) return [String(u)];
    return [];
  }
  // Probamos distintos hosts/paths que suelen funcionar según cuenta/archivo
  return [
    // Content CDN (muy fiable para <img>)
    `https://lh3.googleusercontent.com/d/${id}=w1200`,
    // Vista directa
    `https://drive.google.com/uc?export=view&id=${id}`,
    // Forzamos descarga (algunos navegadores igual la muestran)
    `https://drive.google.com/uc?export=download&id=${id}`,
    // Thumbnail API (define ancho aprox)
    `https://drive.google.com/thumbnail?id=${id}&sz=w1200`
  ];
}

const PLACEHOLDER = 'https://via.placeholder.com/600x450?text=FERJO';

function render(products){
  const grid = document.getElementById('grid');
  const tpl = document.getElementById('card-tpl');
  grid.innerHTML = '';

  products.forEach(p=>{
    const node = tpl.content.cloneNode(true);

    // Texto
    node.querySelector('.name').textContent = p.nombre || '(Sin nombre)';
    node.querySelector('.sku').textContent = `Código: ${p.id_del_articulo || p.upc_ean_isbn || '-'}`;
    node.querySelector('.price').textContent = `Precio: ${formatPrice(p.precio_de_venta, p.moneda)}`;

    const sinStock = (p.cantidad||0) <= 0 || String(p.status||'').toLowerCase() === 'sin_stock';
    node.querySelector('.stock').textContent = sinStock ? 'Sin stock' : `Stock: ${p.cantidad}`;
    const btn = node.querySelector('.btn');
    btn.disabled = sinStock;
    btn.addEventListener('click',()=>{
      alert('Demo: aquí podríamos abrir WhatsApp o un formulario de pedido.');
    });

    // Imagen con Fallback progresivo
    const img = node.querySelector('img');
    img.alt = p.nombre || 'Producto FERJO';
    img.loading = 'lazy';

    const rawSrc = p.image_url || p.image_url_2 || p.image_url_3 || '';
    const variants = driveVariantsFromUrl(rawSrc);
    let idx = 0;

    function tryNext(){
      if (idx < variants.length) {
        const url = variants[idx++];
        img.onerror = onFail;
        img.src = url;
      } else {
        img.onerror = null;
        img.src = PLACEHOLDER;
      }
    }
    function onFail(){
      console.warn('Imagen falló:', { id: p.id_del_articulo, nombre: p.nombre, src: img.src });
      tryNext();
    }

    if (variants.length === 0) {
      img.src = PLACEHOLDER;
    } else {
      tryNext();
    }

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
