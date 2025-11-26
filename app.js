/* ============ API BASE ============ */
// Usa la misma clave que el Admin (FERJO_API_BASE).
// También acepta window.CONFIG.API como fallback.
// Siempre sin slash final redundante.
function apiBase(){
  const saved = localStorage.getItem('FERJO_API_BASE') || (window.CONFIG && window.CONFIG.API) || '';
  return (saved || '').replace(/\/+$/,'');
}

/* ============ FETCH DE PRODUCTOS ============ */
// Construye ...?path=products&t=... sin duplicar /exec
function buildProductsUrl() {
  const BASE = apiBase();
  if (!BASE) return '';
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

function driveVariantsFromUrl(u){
  const id = extractDriveId(u);
  if (!id) {
    if (u && /^https?:\/\//i.test(String(u))) return [String(u)];
    return [];
  }
  return [
    `https://drive.google.com/uc?export=view&id=${id}`,       // ORIGINAL
    `https://drive.google.com/uc?export=download&id=${id}`,   // fallback
    `https://lh3.googleusercontent.com/d/${id}=w1600`,        // CDN
    `https://drive.google.com/thumbnail?id=${id}&sz=w1600`    // puede recortar
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

    // Texto base
    const nombre = p.nombre || '(Sin nombre)';
    const sku    = p.id_del_articulo || p.upc_ean_isbn || '-';

    node.querySelector('.name').textContent = nombre;
    node.querySelector('.sku').textContent   = `Código: ${sku}`;
    node.querySelector('.price').textContent = `Precio: ${formatPrice(p.precio_de_venta, p.moneda)}`;

    const sinStock = (p.cantidad||0) <= 0 || String(p.status||'').toLowerCase() === 'sin_stock';
    const stockEl  = node.querySelector('.stock');
    stockEl.textContent = sinStock ? 'Sin stock' : `Stock: ${p.cantidad}`;

    // Usamos el botón de agregar al carrito explícitamente
    const btnAdd = node.querySelector('.btn-add-cart');
    if (btnAdd) {
      btnAdd.disabled = sinStock;
    }

    // ----- Carrusel (image_url, image_url_2, image_url_3) -----
    const img      = node.querySelector('.img img');
    const btnPrev  = node.querySelector('.nav.prev');
    const btnNext  = node.querySelector('.nav.next');
    const dotsBox  = node.querySelector('.dots');
    const imgBox   = node.querySelector('.img');

    const sourcesRaw = [p.image_url, p.image_url_2, p.image_url_3].filter(Boolean);

    let idxImage   = 0;   // índice de imagen
    let idxVariant = 0;   // índice de variante
    let variants   = [];  // variantes URL para la imagen actual

    function buildDots(){
      dotsBox.innerHTML = '';
      if (sourcesRaw.length > 1){
        sourcesRaw.forEach((_, i)=>{
          const dot = document.createElement('span'); // <span> para encajar con tus estilos
          if (i === idxImage) dot.classList.add('active');
          dot.addEventListener('click', ev=>{
            ev.stopPropagation();
            setImageIndex(i);
          });
          dotsBox.appendChild(dot);
        });
      }
    }

    function setImageIndex(i){
      idxImage   = i;
      idxVariant = 0;
      variants   = driveVariantsFromUrl(sourcesRaw[idxImage]);
      loadCurrentVariant();
      buildDots();
    }

    function loadCurrentVariant(){
      if (!variants || variants.length === 0){
        img.onerror = img.onload = null;
        img.src = PLACEHOLDER;
        imgBox && imgBox.classList.remove('portrait','landscape');
        return;
      }
      if (idxVariant >= variants.length){
        img.onerror = img.onload = null;
        img.src = PLACEHOLDER;
        imgBox && imgBox.classList.remove('portrait','landscape');
        return;
      }

      const url = variants[idxVariant++];

      img.alt     = nombre || 'Producto FERJO';
      img.loading = 'lazy';

      img.onerror = function(){
        // Intenta la siguiente variante de esta misma imagen
        loadCurrentVariant();
      };

      img.onload = function(){
        if (!imgBox) return;
        imgBox.classList.remove('portrait','landscape');
        if (img.naturalHeight > img.naturalWidth) {
          imgBox.classList.add('portrait');
        } else {
          imgBox.classList.add('landscape');
        }
      };

      img.src = url;
    }

    if (sourcesRaw.length > 1){
      btnPrev.style.display = btnNext.style.display = 'inline-flex';
      btnPrev.addEventListener('click', ev=>{
        ev.stopPropagation();
        const n = sourcesRaw.length;
        setImageIndex((idxImage - 1 + n) % n);
      });
      btnNext.addEventListener('click', ev=>{
        ev.stopPropagation();
        const n = sourcesRaw.length;
        setImageIndex((idxImage + 1) % n);
      });
    } else {
      btnPrev.style.display = btnNext.style.display = 'none';
    }

    if (sourcesRaw.length === 0){
      img.src = PLACEHOLDER;
      img.alt = nombre || 'Producto FERJO';
    } else {
      setImageIndex(0);
    }

    grid.appendChild(node);
  });
}

/* ============ FILTROS ============ */
function hydrateFilters(products){
  const sel = document.getElementById('category');
  const cats = Array.from(
    new Set(
      products
        .map(p=> (p.categoria||'').trim())
        .filter(Boolean)
    )
  ).sort();

  cats.forEach(c=>{
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
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

    const searchEl   = document.getElementById('search');
    const categoryEl = document.getElementById('category');

    function applyFilters(){
      const q   = (searchEl.value || '').toLowerCase().trim();
      const cat = categoryEl.value;

      const list = window.__PRODUCTS__.filter(p=> {
        const nombre  = (p.nombre||'').toLowerCase();
        const cod1    = (p.id_del_articulo||'').toLowerCase();
        const cod2    = (p.upc_ean_isbn||'').toLowerCase();
        const hay     = nombre.includes(q) || cod1.includes(q) || cod2.includes(q);
        const okCat   = !cat || (p.categoria||'') === cat;
        return hay && okCat;
      });

      render(list);
    }

    searchEl.addEventListener('input', applyFilters);
    categoryEl.addEventListener('change', applyFilters);

  } catch (e){
    document.getElementById('grid').innerHTML =
      '<p>Error cargando productos. Revisa la URL del API en <code>config.js</code> o guarda <code>FERJO_API_BASE</code> en localStorage.</p>';
    console.error(e);
  }
}

main();
