/* ============ API BASE ============ */
// Usa la misma clave que el Admin (FERJO_API_BASE).
// También acepta window.CONFIG.API como fallback.
// Siempre sin slash final redundante; puede terminar en .../exec (está bien).
function apiBase(){
  const saved = localStorage.getItem('FERJO_API_BASE') || (window.CONFIG && window.CONFIG.API) || '';
  return (saved || '').replace(/\/+$/,'');
}

/* ============ FETCH DE PRODUCTOS ============ */
// Construye .../exec?path=products&t=... sin duplicar /exec
function buildProductsUrl() {
  const BASE = apiBase();
  if (!BASE) return '';
  // Si BASE ya es .../exec → agrega ?path=...
  // Si BASE NO trae query, ponemos ?; si ya trae, usamos &
  const join = BASE.includes('?') ? '&' : '?';
  return `${BASE}${join}path=products&t=${Date.now()}`;
}

async function fetchProducts() {
  const url = buildProductsUrl();
  if (!url) {
    throw new Error('No hay API configurada. Define window.CONFIG.API en config.js o guarda FERJO_API_BASE en localStorage.');
  }
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('No se pudo cargar el catálogo');

  // Intenta leer JSON de forma segura
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json')
    ? await res.json()
    : JSON.parse(await res.text());

  return data.products || [];
}

/* ============ UTILIDADES ============ */
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
  // ...uc?export=view&id=<ID> (o cualquier uc?...id=)
  m = u.match(/uc\?[^#]*id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return '';
}

// Devuelve variantes de URL para un mismo ID de Drive
function driveVariantsFromUrl(u){
  const id = extractDriveId(u);
  if (!id) {
    if (u && /^https?:\/\//i.test(String(u))) return [String(u)];
    return [];
  }
  // Prioriza la imagen original sin recortes
  return [
    `https://drive.google.com/uc?export=view&id=${id}`,       // ORIGINAL (primero)
    `https://drive.google.com/uc?export=download&id=${id}`,   // fallback
    `https://lh3.googleusercontent.com/d/${id}=w1600`,        // CDN (tercero)
    `https://drive.google.com/thumbnail?id=${id}&sz=w1600`    // último (puede recortar)
  ];
}

const PLACEHOLDER = 'https://via.placeholder.com/600x450?text=FERJO';

/* ============ RENDER ============ */
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

    // ----- Carrusel (usa image_url, image_url_2, image_url_3) -----
    const img = node.querySelector('img');
    const btnPrev = node.querySelector('.nav.prev');
    const btnNext = node.querySelector('.nav.next');
    const dotsBox = node.querySelector('.dots');

    // Lista base de imágenes del producto (máx 3)
    const sourcesRaw = [p.image_url, p.image_url_2, p.image_url_3].filter(Boolean);
    // Estado
    let idxImage = 0;         // índice de imagen dentro de sourcesRaw
    let idxVariant = 0;       // variante a probar para la imagen actual
    let variants = [];        // variantes para la imagen actual

    function buildDots(){
      dotsBox.innerHTML = '';
      if (sourcesRaw.length > 1){
        sourcesRaw.forEach((_, i)=>{
          const dot = document.createElement('i');
          if (i === idxImage) dot.classList.add('active');
          dot.addEventListener('click', (ev)=>{ ev.stopPropagation(); setImageIndex(i); });
          dotsBox.appendChild(dot);
        });
      }
    }

    function setImageIndex(i){
      idxImage = i;
      idxVariant = 0;
      variants = driveVariantsFromUrl(sourcesRaw[idxImage]);
      loadCurrentVariant();
      buildDots();
    }

    function loadCurrentVariant(){
      if (!variants || variants.length === 0){
        img.onerror = img.onload = null;
        img.src = PLACEHOLDER;
        node.querySelector('.img').classList.remove('portrait','landscape');
        return;
      }
      if (idxVariant >= variants.length){
        img.onerror = img.onload = null;
        img.src = PLACEHOLDER;
        node.querySelector('.img').classList.remove('portrait','landscape');
        return;
      }
      const url = variants[idxVariant++];
    
      img.alt = p.nombre || 'Producto FERJO';
      img.loading = 'lazy';
    
      img.onerror = function(){
        // intenta la siguiente variante
        loadCurrentVariant();
      };
    
      img.onload = function(){
        // Ajusta el aspect ratio según la foto real
        const box = img.closest('.img');
        if (!box) return;   // seguridad por si acaso
        box.classList.remove('portrait','landscape');
        if (img.naturalHeight > img.naturalWidth) {
          box.classList.add('portrait');   // 3:4
        } else {
          box.classList.add('landscape');  // 4:3
        }
      };
    
      img.src = url;
    }
    
    if (sourcesRaw.length > 1){
      btnPrev.style.display = btnNext.style.display = 'inline-flex';
      btnPrev.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        const n = sourcesRaw.length;
        setImageIndex((idxImage - 1 + n) % n);
      });
      btnNext.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        const n = sourcesRaw.length;
        setImageIndex((idxImage + 1) % n);
      });
    } else {
      btnPrev.style.display = btnNext.style.display = 'none';
    }

    if (sourcesRaw.length === 0){
      img.src = PLACEHOLDER;
    } else {
      setImageIndex(0); // inicializa primera imagen + variantes
    }

    grid.appendChild(node);
  });
}

/* ============ FILTROS ============ */
function hydrateFilters(products){
  const sel = document.getElementById('category');
  const cats = Array.from(new Set(products.map(p=> (p.categoria||'').trim()).filter(Boolean))).sort();
  cats.forEach(c=>{
    const opt = document.createElement('option');
    opt.value=c; opt.textContent=c;
    sel.appendChild(opt);
  });
}

/* ============ MAIN ============ */
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
    document.getElementById('grid').innerHTML = '<p>Error cargando productos. Revisa la URL del API en <code>config.js</code> o guarda <code>FERJO_API_BASE</code> en localStorage.</p>';
    console.error(e);
  }
}

main();
