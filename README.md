# FERJO — Catálogo estático (GitHub → Netlify)
Repo minimalista sin build (HTML/CSS/JS puros).

## Configurar la API
Edita `config.js` y coloca tu URL de Apps Script:
```js
window.CONFIG = { API: 'https://script.google.com/macros/s/TU_ID/exec?path=products' };
```

> Alternativa rápida:
```js
localStorage.setItem('FERJO_API','https://.../exec?path=products')
location.reload()
```

## Despliegue
1. Sube estos archivos a un repo en GitHub.
2. En Netlify: New Site from Git → selecciona el repo → Publish (sin build).
3. Listo. El catálogo leerá productos desde tu API.
