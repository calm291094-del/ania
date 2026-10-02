/* ============================================================
   17-SYNC-GITHUB · Sincronización de reglas con GitHub
============================================================ */
'use strict';

const SyncGitHub = {
  TOKEN_KEY: 'ania_gh_token',
  REPO_OWNER: 'calm291094-del',
  REPO_NAME: 'ania',
  BRANCH: 'main',
  FILE_PATH: 'datos/reglas_usuario.json',

  getToken(){ return store.get(this.TOKEN_KEY, null); },
  setToken(t){ store.set(this.TOKEN_KEY, t); },
  borrarToken(){ store.del(this.TOKEN_KEY); },
  configurado(){ return !!this.getToken(); },

  async pullReglas(){
    const token = this.getToken();
    if (!token) return null;
    try {
      const url = `https://api.github.com/repos/${this.REPO_OWNER}/${this.REPO_NAME}/contents/${this.FILE_PATH}?ref=${this.BRANCH}`;
      const r = await fetch(url, {
        headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('GitHub ' + r.status);
      const data = await r.json();
      const content = atob(data.content.replace(/\n/g, ''));
      const json = JSON.parse(decodeURIComponent(escape(content)));
      console.log('📥 Reglas desde GitHub:', json.length || 0);
      return json;
    } catch(e) { console.warn('[Sync] Error pull:', e.message); return null; }
  },

  async pushReglas(reglas){
    const token = this.getToken();
    if (!token) return false;
    try {
      let sha = null;
      try {
        const r = await fetch(`https://api.github.com/repos/${this.REPO_OWNER}/${this.REPO_NAME}/contents/${this.FILE_PATH}?ref=${this.BRANCH}`, {
          headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        if (r.ok) { const d = await r.json(); sha = d.sha; }
      } catch(e) {}

      const json = JSON.stringify(reglas, null, 2);
      const content = btoa(unescape(encodeURIComponent(json)));
      const body = {
        message: `Ania: reglas actualizadas — ${new Date().toLocaleString('es-ES')}`,
        content, branch: this.BRANCH
      };
      if (sha) body.sha = sha;

      const r = await fetch(`https://api.github.com/repos/${this.REPO_OWNER}/${this.REPO_NAME}/contents/${this.FILE_PATH}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error('GitHub ' + r.status);
      console.log('📤 Reglas enviadas a GitHub');
      return true;
    } catch(e) { console.warn('[Sync] Error push:', e.message); return false; }
  },

  async sincronizar(reglasLocales){
    const token = this.getToken();
    if (!token) return null;
    const remotas = await this.pullReglas();
    const map = new Map();
    (remotas || []).forEach(r => map.set(r.id, r));
    (reglasLocales || []).forEach(r => {
      const existente = map.get(r.id);
      if (!existente || (r.t || 0) > (existente.t || 0)) map.set(r.id, r);
    });
    const merge = Array.from(map.values());
    if (merge.length) await this.pushReglas(merge);
    return merge;
  }
};

window.SyncGitHub = SyncGitHub;
