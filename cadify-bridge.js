/* ============================================================
   CADify Bridge — DUAL MODE (local now, cloud later)

   ONE data layer + auth surface for the hub AND all calculators.

     • LOCAL mode  (default)  — localStorage, stub login, dev sub toggle.
                                 Everything works here & offline. Used to
                                 build and debug the whole app.
     • CLOUD mode  (later)    — Firebase Auth + Firestore + Stripe.
                                 Enabled by CADify.init(FIREBASE_CONFIG).

   Same public API in both modes, so the app never changes when we swap.
   ============================================================ */
(function (global) {
  'use strict';

  var mode = 'local';
  var mirror = blank();
  var currentUser = null;
  var sub = { active: false, role: null };
  var cbData = [], cbUser = [], cbSub = [];

  // cloud handles
  var db = null, auth = null, subsUnsub = [];

  function blank() { return { clients: [], jobs: [], settings: { activeClientId: null }, activity: [] }; }
  function newId(p) { return (p || 'id') + '_' + Math.abs(Date.now() ^ (Math.random() * 1e9 | 0)).toString(36) + (Math.random() * 1e4 | 0).toString(36); }
  function emitData() { cbData.forEach(function (f) { try { f(mirror); } catch (e) {} }); }
  function emitUser() { cbUser.forEach(function (f) { try { f(currentUser); } catch (e) {} }); }
  function emitSub() { cbSub.forEach(function (f) { try { f(sub); } catch (e) {} }); }
  function normalize() {
    ['clients', 'jobs', 'activity'].forEach(function (k) { if (!Array.isArray(mirror[k])) mirror[k] = []; });
    if (!mirror.settings) mirror.settings = { activeClientId: null };
    mirror.clients.forEach(function (c) { c.results = c.results || []; });
  }

  /* ============================================================
     LOCAL MODE
     ============================================================ */
  var ACCT_KEY = 'cadify.accounts';        // { uid: {email,name,pw,sub} }
  var SESSION_KEY = 'cadify.session';      // uid of signed-in local account
  function dataKey() { return 'cadify.v1:' + (currentUser ? currentUser.uid : 'guest'); }

  function localLoad() {
    try { var r = localStorage.getItem(dataKey()); mirror = r ? JSON.parse(r) : blank(); }
    catch (e) { mirror = blank(); }
    normalize(); emitData();
  }
  function localSave() { try { localStorage.setItem(dataKey(), JSON.stringify(mirror)); } catch (e) {} emitData(); }
  function accts() { try { return JSON.parse(localStorage.getItem(ACCT_KEY) || '{}'); } catch (e) { return {}; } }
  function acctSave(a) { localStorage.setItem(ACCT_KEY, JSON.stringify(a)); }

  function localSetUser(u) {
    currentUser = u;
    if (u) localStorage.setItem(SESSION_KEY, u.uid); else localStorage.removeItem(SESSION_KEY);
    if (u) {
      var a = accts()[u.uid] || {};
      sub = { active: !!a.sub, role: a.sub ? 'dev' : null };
      localLoad();
    } else {
      mirror = blank(); sub = { active: false, role: null }; emitData();
    }
    emitUser(); emitSub();
  }

  function localResume() {
    var uid = localStorage.getItem(SESSION_KEY);
    var a = accts();
    if (uid && a[uid]) localSetUser({ uid: uid, email: a[uid].email, name: a[uid].name });
    else { emitUser(); emitSub(); emitData(); }
  }

  // keep the hub and any calculator iframes in sync (same-origin localStorage)
  function onStorage(e) {
    if (mode !== 'local' || !e) return;
    if (e.key === SESSION_KEY) { localResume(); return; }
    if (e.key === dataKey()) { localLoad(); }
  }

  var localAuth = {
    signUp: function (email, pw, name) {
      return new Promise(function (res, rej) {
        email = (email || '').trim().toLowerCase();
        if (!email || !pw) return rej(new Error('Email and password required'));
        var a = accts();
        for (var k in a) if (a[k].email === email) return rej(new Error('That email is already registered'));
        var uid = newId('u');
        a[uid] = { email: email, name: (name || '').trim(), pw: pw, sub: false };
        acctSave(a); localSetUser({ uid: uid, email: email, name: a[uid].name }); res(currentUser);
      });
    },
    signIn: function (email, pw) {
      return new Promise(function (res, rej) {
        email = (email || '').trim().toLowerCase();
        var a = accts(), found = null;
        for (var k in a) if (a[k].email === email) found = { uid: k, rec: a[k] };
        if (!found) return rej(new Error('No account with that email'));
        if (found.rec.pw !== pw) return rej(new Error('Wrong password'));
        localSetUser({ uid: found.uid, email: email, name: found.rec.name }); res(currentUser);
      });
    },
    signInGoogle: function () { return this.signUp('demo.google@cadify.app', 'google', 'Google User').catch(function () { return localAuth.signIn('demo.google@cadify.app', 'google'); }); },
    reset: function () { return Promise.resolve(); },
    signOut: function () { return new Promise(function (res) { localSetUser(null); res(); }); }
  };

  // dev-only subscription toggle for local testing of the paywall
  function localSetSub(active) {
    if (!currentUser) return;
    var a = accts(); if (a[currentUser.uid]) { a[currentUser.uid].sub = !!active; acctSave(a); }
    sub = { active: !!active, role: active ? 'dev' : null }; emitSub();
  }

  /* ============================================================
     CLOUD MODE (Firebase) — same behaviour, remote backing
     ============================================================ */
  function cloudInit(cfg) {
    mode = 'cloud';
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    db = firebase.firestore();
    db.enablePersistence({ synchronizeTabs: true }).catch(function () {});
    auth.onAuthStateChanged(function (u) {
      subsUnsub.forEach(function (f) { try { f(); } catch (e) {} }); subsUnsub = [];
      currentUser = u ? { uid: u.uid, email: u.email, name: u.displayName } : null;
      if (u) cloudBind(u); else { mirror = blank(); sub = { active: false, role: null }; emitData(); emitSub(); }
      emitUser();
    });
  }
  function uDoc() { return db.collection('users').doc(currentUser.uid); }
  function cloudBind(u) {
    uDoc().set({ email: u.email || null, updatedAt: Date.now() }, { merge: true });
    subsUnsub.push(uDoc().collection('clients').onSnapshot(function (s) {
      mirror.clients = s.docs.map(function (d) { var o = d.data() || {}; o.id = d.id; o.results = o.results || []; return o; })
        .sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
      emitData();
    }));
    subsUnsub.push(uDoc().collection('jobs').onSnapshot(function (s) {
      mirror.jobs = s.docs.map(function (d) { var o = d.data() || {}; o.id = d.id; return o; }); emitData();
    }));
    subsUnsub.push(uDoc().onSnapshot(function (d) {
      var v = d.data() || {}; mirror.settings = v.settings || { activeClientId: null }; mirror.activity = v.activity || []; emitData();
    }));
    subsUnsub.push(db.collection('customers').doc(u.uid).collection('subscriptions')
      .where('status', 'in', ['trialing', 'active']).onSnapshot(function (s) {
        sub.active = !s.empty; sub.role = s.empty ? null : ((s.docs[0].data() || {}).role || 'active'); emitSub();
      }, function () {}));
  }
  var cloudAuth = {
    signUp: function (email, pw, name) {
      return auth.createUserWithEmailAndPassword(email, pw).then(function (c) {
        if (name) return c.user.updateProfile({ displayName: name }).then(function () { return c.user; });
        return c.user;
      });
    },
    signIn: function (email, pw) { return auth.signInWithEmailAndPassword(email, pw); },
    signInGoogle: function () { return auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); },
    reset: function (email) { return auth.sendPasswordResetEmail(email); },
    signOut: function () { return auth.signOut(); }
  };

  /* ---------------- shared write helpers ---------------- */
  function pushActivity(text) {
    var activity = [{ text: text, at: Date.now() }].concat(mirror.activity || []).slice(0, 25);
    if (mode === 'cloud') { uDoc().set({ activity: activity }, { merge: true }); }
    else { mirror.activity = activity; localSave(); }
  }
  function activeClientObj() {
    return mirror.clients.filter(function (c) { return c.id === mirror.settings.activeClientId; })[0] || null;
  }
  var DRAW_LIMIT = 180000;
  function drawSize(rec) { try { return rec && rec.drawings ? JSON.stringify(rec.drawings).length : 0; } catch (e) { return 0; } }

  /* ============================================================
     PUBLIC API
     ============================================================ */
  var CADify = {
    get mode() { return mode; },

    init: function (cfg) { if (cfg) cloudInit(cfg); else this.initLocal(); },
    initLocal: function () {
      mode = 'local';
      if (!CADify._hooked) { CADify._hooked = true; global.addEventListener('storage', onStorage); }
      localResume();
    },

    auth: {
      signUp: function (e, p, n) { return (mode === 'cloud' ? cloudAuth : localAuth).signUp(e, p, n); },
      signIn: function (e, p) { return (mode === 'cloud' ? cloudAuth : localAuth).signIn(e, p); },
      signInGoogle: function () { return (mode === 'cloud' ? cloudAuth : localAuth).signInGoogle(); },
      reset: function (e) { return (mode === 'cloud' ? cloudAuth : localAuth).reset(e); },
      signOut: function () { return (mode === 'cloud' ? cloudAuth : localAuth).signOut(); },
      currentUser: function () { return currentUser; },
      onUser: function (cb) { cbUser.push(cb); cb(currentUser); }
    },

    subscription: function () { return sub; },
    onSub: function (cb) { cbSub.push(cb); cb(sub); },
    devSetSubscription: function (active) { if (mode === 'local') localSetSub(active); },
    startCheckout: function (priceId) {
      if (mode !== 'cloud') { localSetSub(true); return Promise.resolve('local-dev'); }
      return db.collection('customers').doc(currentUser.uid).collection('checkout_sessions')
        .add({ price: priceId, mode: 'subscription', success_url: global.location.origin, cancel_url: global.location.origin })
        .then(function (ref) {
          return new Promise(function (resolve, reject) {
            ref.onSnapshot(function (snap) { var d = snap.data() || {}; if (d.error) reject(new Error(d.error.message)); if (d.url) { global.location.assign(d.url); resolve(d.url); } });
          });
        });
    },

    onData: function (cb) { cbData.push(cb); cb(mirror); },

    /* clients */
    clients: function () { return mirror.clients; },
    settings: function () { return mirror.settings; },
    activeClient: activeClientObj,
    setActiveClient: function (id) {
      if (mode === 'cloud') return uDoc().set({ settings: { activeClientId: id } }, { merge: true });
      mirror.settings.activeClientId = id || null; localSave();
    },
    addClient: function (data) {
      var c = Object.assign({ createdAt: Date.now(), results: [] }, data);
      if (mode === 'cloud') {
        var ref = uDoc().collection('clients').doc(); c.id = ref.id; ref.set(c);
        uDoc().set({ settings: { activeClientId: ref.id } }, { merge: true });
      } else {
        c.id = newId('cli'); mirror.clients.push(c); mirror.settings.activeClientId = c.id; localSave();
      }
      pushActivity('Added client “' + (data.name || 'client') + '”');
      return c.id;
    },
    updateClient: function (id, data) {
      if (mode === 'cloud') return uDoc().collection('clients').doc(id).set(data, { merge: true });
      var c = mirror.clients.filter(function (x) { return x.id === id; })[0]; if (c) { Object.assign(c, data); localSave(); }
    },
    removeClient: function (id) {
      if (mode === 'cloud') {
        uDoc().collection('jobs').where('clientId', '==', id).get().then(function (s) { s.forEach(function (d) { d.ref.delete(); }); });
        return uDoc().collection('clients').doc(id).delete();
      }
      mirror.clients = mirror.clients.filter(function (c) { return c.id !== id; });
      mirror.jobs = mirror.jobs.filter(function (j) { return j.clientId !== id; });
      if (mirror.settings.activeClientId === id) mirror.settings.activeClientId = (mirror.clients[0] || {}).id || null;
      localSave();
    },

    /* jobs */
    jobs: function () { return mirror.jobs; },
    addJob: function (data) {
      var j = Object.assign({ createdAt: Date.now() }, data);
      if (mode === 'cloud') { var ref = uDoc().collection('jobs').doc(); j.id = ref.id; ref.set(j); }
      else { j.id = newId('job'); mirror.jobs.push(j); localSave(); }
      pushActivity('Scheduled job “' + (data.title || 'job') + '”');
      return j.id;
    },
    updateJob: function (id, data) {
      if (mode === 'cloud') return uDoc().collection('jobs').doc(id).set(data, { merge: true });
      var j = mirror.jobs.filter(function (x) { return x.id === id; })[0]; if (j) { Object.assign(j, data); localSave(); }
    },
    removeJob: function (id) {
      if (mode === 'cloud') return uDoc().collection('jobs').doc(id).delete();
      mirror.jobs = mirror.jobs.filter(function (j) { return j.id !== id; }); localSave();
    },

    /* calculator result → active client folder.
       A result may carry jobId (assigned to a job) or null (Unassigned bucket). */
    file: function (record) {
      if (!currentUser) { console.warn('[CADify] not signed in'); return null; }
      var c = activeClientObj(); if (!c) { console.warn('[CADify] no active client'); return null; }
      var r = Object.assign({ id: newId('res'), createdAt: Date.now(), icon: '📄', jobId: null }, record);
      if (r.jobId === undefined) r.jobId = null;
      if (drawSize(r) > DRAW_LIMIT) { r._drawingsOmitted = true; delete r.drawings; }
      var results = [r].concat(c.results || []);
      if (mode === 'cloud') uDoc().collection('clients').doc(c.id).set({ results: results }, { merge: true });
      else { c.results = results; localSave(); }
      pushActivity((record.module || 'Calc') + ': “' + (record.title || 'result') + '” → ' + c.name);
      return r;
    },
    /* assign (or re-assign) a filed calculation to a job (jobId) or Unassigned (null) */
    assignResult: function (clientId, resultId, jobId) {
      var c = mirror.clients.filter(function (x) { return x.id === clientId; })[0]; if (!c) return null;
      var r = (c.results || []).filter(function (x) { return x.id === resultId; })[0]; if (!r) return null;
      r.jobId = jobId || null;
      if (mode === 'cloud') uDoc().collection('clients').doc(clientId).set({ results: c.results }, { merge: true });
      else localSave();
      return r;
    },
    delResult: function (clientId, resultId) {
      var c = mirror.clients.filter(function (x) { return x.id === clientId; })[0]; if (!c) return;
      var results = (c.results || []).filter(function (r) { return r.id !== resultId; });
      if (mode === 'cloud') return uDoc().collection('clients').doc(clientId).set({ results: results }, { merge: true });
      c.results = results; localSave();
    },

    activity: function () { return mirror.activity; }
  };

  global.CADify = CADify;
})(window);
