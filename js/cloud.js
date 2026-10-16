// Cloud layer (Supabase): anonymous account per browser, optional Google sign-in, progress sync, leaderboard.
// Everything degrades to local-only when Supabase is unreachable (for example inside a sandboxed preview).
(function (root) {
  const CC = (root.CC = root.CC || {});
  const listeners = new Set();
  const cloud = {
    status: 'off', // off | connecting | ready | unavailable | anon-disabled | error
    message: '',
    user: null,
    lastSync: null,
    client: null,
  };

  function emit() {
    listeners.forEach((fn) => {
      try { fn(cloud); } catch (e) {}
    });
  }
  function set(status, message) {
    cloud.status = status;
    cloud.message = message || '';
    emit();
  }

  const isAnon = () => !cloud.user || cloud.user.is_anonymous !== false;
  const email = () => (cloud.user && (cloud.user.email || (cloud.user.user_metadata && cloud.user.user_metadata.email))) || '';

  async function init() {
    const lib = root.supabase;
    if (!lib || !lib.createClient || !CC.CONFIG || !CC.CONFIG.supabaseUrl) return set('unavailable', 'Cloud library did not load. Progress stays in this browser.');
    set('connecting');
    try {
      cloud.client = lib.createClient(CC.CONFIG.supabaseUrl, CC.CONFIG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      });
      cloud.client.auth.onAuthStateChange((event, session) => {
        const prev = cloud.user && cloud.user.id;
        cloud.user = session ? session.user : null;
        if (session && prev && prev !== session.user.id) pull(true); // switched account (e.g. Google sign-in)
        emit();
      });
      let { data } = await cloud.client.auth.getSession();
      let session = data && data.session;
      if (!session) {
        const res = await cloud.client.auth.signInAnonymously();
        if (res.error) {
          const anonOff = /anonymous/i.test(res.error.message || '');
          return set(anonOff ? 'anon-disabled' : 'unavailable', anonOff ? 'Anonymous sign-ins are switched off in Supabase.' : 'Could not reach the cloud: ' + res.error.message);
        }
        session = res.data.session;
      }
      cloud.user = session.user;
      await pull(false);
      if (cloud.status !== 'error') set('ready');
    } catch (e) {
      set('unavailable', 'Could not reach the cloud. Progress stays in this browser.');
    }
  }

  // Merge rule: keep whichever copy was saved most recently; a browser with no history always takes the cloud copy.
  async function pull(accountSwitch) {
    if (!cloud.client || !cloud.user) return;
    const { data, error } = await cloud.client.from('progress').select('data, updated_at').eq('user_id', cloud.user.id).maybeSingle();
    if (error) return set('error', 'Sync failed: ' + error.message);
    const local = CC.store.state;
    if (data && data.data) {
      const remoteAt = data.data.savedAt || Date.parse(data.updated_at) || 0;
      const otherOwner = local.ownerId && local.ownerId !== cloud.user.id;
      if (accountSwitch || otherOwner || CC.store.isEmpty() || remoteAt > (local.savedAt || 0)) {
        CC.store.replace(data.data);
        cloud.lastSync = Date.now();
        if (CC.UI && CC.UI.current) CC.UI.navigate(CC.UI.current, { keepScroll: true });
        if (CC.UI && CC.UI.toast) CC.UI.toast('Progress loaded from the cloud.', 'good');
        return;
      }
    }
    await push();
  }

  let pushTimer = null;
  function schedulePush() {
    if (cloud.status !== 'ready') return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 2500);
  }
  async function push() {
    if (!cloud.client || !cloud.user) return;
    CC.store.state.ownerId = cloud.user.id;
    const { error } = await cloud.client.from('progress').upsert({ user_id: cloud.user.id, data: CC.store.state, updated_at: new Date().toISOString() });
    if (error) return set('error', 'Sync failed: ' + error.message);
    cloud.lastSync = Date.now();
    emit();
  }

  async function signInWithGoogle() {
    if (!cloud.client) throw new Error('Cloud is not connected.');
    const redirectTo = location.origin + location.pathname;
    // Keep the anonymous account's data by linking Google to it; fall back to a normal sign-in if that Google account already exists.
    if (cloud.user && isAnon()) {
      const { error } = await cloud.client.auth.linkIdentity({ provider: 'google', options: { redirectTo } });
      if (!error) return;
      if (!/already|exists|linked|manual linking/i.test(error.message || '')) throw error;
    }
    const { error } = await cloud.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) throw error;
  }

  async function signOut() {
    if (!cloud.client) return;
    await push();
    await cloud.client.auth.signOut();
    const res = await cloud.client.auth.signInAnonymously();
    cloud.user = res.data && res.data.session ? res.data.session.user : null;
    await push();
    emit();
  }

  async function submitScore(res) {
    const name = (CC.store.state.settings.displayName || '').trim();
    if (cloud.status !== 'ready' || name.length < 2) return { skipped: true };
    const { error } = await cloud.client.rpc('submit_score', { p_name: name, p_test: res.id, p_diff: res.difficulty, p_timed: !!res.timed, p_correct: res.correct, p_n: res.n, p_secs: Math.max(1, res.secs) });
    return error ? { error } : { ok: true };
  }

  async function leaderboard(testId, difficulty, timed) {
    if (!cloud.client) throw new Error('Cloud is not connected.');
    const { data, error } = await cloud.client
      .from('leaderboard')
      .select('user_id, display_name, pct, correct, n, secs, created_at')
      .eq('test_id', testId)
      .eq('difficulty', difficulty)
      .eq('timed', timed)
      .order('pct', { ascending: false })
      .order('secs', { ascending: true })
      .limit(25);
    if (error) throw error;
    return data;
  }

  Object.assign(cloud, {
    init,
    push,
    schedulePush,
    signInWithGoogle,
    signOut,
    submitScore,
    leaderboard,
    isAnon,
    email,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  });
  CC.cloud = cloud;
})(typeof globalThis !== 'undefined' ? globalThis : this);
