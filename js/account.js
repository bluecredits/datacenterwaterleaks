/* Data Center Water Leaks — free accounts (Supabase email sign-in)
 *
 * The map stays public. Signing in unlocks basin / utility / site / Loudoun reports and CSV downloads,
 * and each report is logged (who, which report, which area) in the Supabase table public.report_log.
 *
 * Setup: paste your project's public key below (Supabase → Project Settings → API Keys →
 * "anon public" or "publishable" key). NEVER paste the service_role / secret key here.
 * Until a key is set, reports stay open to everyone and nothing is logged.
 */
window.DCWL_ROOT = window.DCWL_ROOT || (document.currentScript && document.currentScript.src ? new URL('../', document.currentScript.src).href : '/');   // site root (account.js lives in /js)
window.DCWL_AUTH = Object.assign({
    url: 'https://efwovptwhousctqakgfy.supabase.co',
    anonKey: 'sb_publishable_VsAWkv_zkGL_GHtl34di7Q_IlBYrlA1',
    // Newsletter opt-in at sign-in goes to the same Google Form as the site pop-up
    newsletterForm: 'https://docs.google.com/forms/d/e/1FAIpQLSfcyUigbpBRD_7Ctpx82_PTX9rwhuDIpxLXjthgpMsrQSFzCA/formResponse',
    newsletterFields: { email: 'entry.67463075', source: 'entry.1205237035' },
    logo: window.DCWL_ROOT + 'logo.png',
    // Pro Supporter (PayPal subscriptions). Paste your LIVE PayPal Client ID and the Plan IDs (P-...) from PayPal.
    // Until these are filled in, "Pro" features fall back to needing a free sign-in only.
    paypal: {
        clientId: 'BAAiGnR-Xq1Jo4GMzScS9Yg_EYW-ZCps7Iu2A6FPNZRzdwyvywNUcxGpMP5q2KdWaAAlnHu1hKOdiW8q9o',
        plans: [
            { id: 'P-5G061659DW1003423NK4YKIQ', label: 'Monthly', price: '$7 / month' },
            { id: 'P-3MS99237WV103480MNK4YK2Q',  label: 'Yearly',  price: '$84 / year', note: 'billed once a year' }
        ],
        fn: 'bright-worker'   // Supabase Edge Function name
    }
}, window.DCWL_AUTH || {});

(function () {
    const C = window.DCWL_AUTH;
    // Placement: map.html uses the default (top-left, next to "Dashboard"); other pages add data-position="top-right" to the script tag
    const SCRIPT = document.currentScript;
    const POS = (SCRIPT && SCRIPT.dataset.position) || 'map';
    const enabled = !!(C.url && C.anonKey && !/PASTE_/.test(C.anonKey));
    let sb = null, user = null, pending = null, readyP = null;
    const PP = C.paypal || {}, PLANS = (PP.plans || []).filter(p => p.id && !/PASTE_/.test(p.id));
    const proEnabled = enabled && PP.clientId && !/PASTE_/.test(PP.clientId) && PLANS.length > 0;
    let plan = { pro: false, expires: null, status: null }, planP = null, proPending = null, ppSDK = null, selPlan = null;

    // ── styles ──
    const css = `
    #acct-chip { position: absolute; top: 20px; left: 150px; z-index: 1001; display: flex; align-items: center; gap: 9px;
        background: #1e6fd9; border: 0; border-radius: 10px; box-shadow: 0 4px 14px rgba(30,111,217,.35); padding: 11px 20px;
        font: 700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #fff; cursor: pointer; }
    #acct-chip:hover { background: #1557b0; }
    #acct-chip.in { background: #fff; color: #0f172a; border: 1px solid #cbd5e1; box-shadow: 0 2px 10px rgba(0,0,0,.15); }
    #acct-chip.in:hover { border-color: #1e6fd9; background: #fff; }
    #acct-chip svg { width: 18px; height: 18px; flex: none; }
    #acct-chip .em { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
    #acct-menu { position: absolute; top: 70px; left: 150px; z-index: 1002; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
        box-shadow: 0 10px 30px rgba(15,23,42,.18); padding: 12px 14px; min-width: 240px; display: none;
        font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #334155; }
    #acct-menu.open { display: block; }
    #acct-menu b { color: #0f172a; display: block; word-break: break-all; margin-bottom: 2px; }
    #acct-menu button { margin-top: 10px; width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; font-weight: 600; cursor: pointer; color: #0f172a; }
    #acct-menu button:hover { background: #f1f5f9; }
    @media (max-width: 700px) { #acct-chip { top: 64px; left: 20px; } #acct-menu { top: 104px; left: 20px; } }
    body.acct-tr #acct-chip { left: auto; right: 24px; top: 22px; z-index: 20; }
    body.acct-tr #acct-menu { left: auto; right: 24px; top: 74px; z-index: 21; }
    @media (max-width: 700px) {
        body.acct-tr #acct-chip { position: fixed; top: auto; bottom: 16px; right: 16px; left: auto; z-index: 900; }
        body.acct-tr #acct-menu { position: fixed; top: auto; bottom: 64px; right: 16px; left: auto; z-index: 901; } }

    #acct-modal { position: fixed; inset: 0; z-index: 5000; background: rgba(15,23,42,.55); display: none; align-items: center; justify-content: center; padding: 16px; }
    #acct-modal.open { display: flex; }
    #acct-card { position: relative; background: #fff; width: 100%; max-width: 410px; border-radius: 14px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.35);
        font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #334155; }
    #acct-card .top { background: linear-gradient(135deg, #0b3a82, #1e6fd9); padding: 16px 24px 14px; color: #fff; text-align: center; }
    #acct-card .top img { height: 58px; width: auto; max-width: 120px; background: #fff; border-radius: 8px; padding: 4px 8px; margin-bottom: 8px; }
    #acct-card h3 { margin: 0; font-size: 19px; }
    #acct-card .top p { margin: 6px 0 0; font-size: 13px; opacity: .9; }
    #acct-card .bd { padding: 20px 24px 22px; }
    #acct-card label.f { display: block; font-size: 12px; font-weight: 700; color: #475569; margin: 0 0 5px; text-transform: uppercase; letter-spacing: .04em; }
    #acct-card input[type=email], #acct-card input[type=text] { width: 100%; box-sizing: border-box; padding: 11px 12px; border: 1px solid #cbd5e1; border-radius: 9px; font-size: 15px; margin-bottom: 12px; }
    #acct-card input:focus { outline: 2px solid #1e6fd9; outline-offset: -1px; border-color: #1e6fd9; }
    #acct-card input.code { letter-spacing: .5em; text-align: center; font-size: 22px; font-weight: 700; }
    #acct-card .chk { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; margin: 2px 0 14px; cursor: pointer; }
    #acct-card .chk input { margin-top: 3px; }
    #acct-card .go { width: 100%; padding: 12px; border: 0; border-radius: 9px; background: #1e6fd9; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }
    #acct-card .go:hover { background: #1557b0; }
    #acct-card .go:disabled { opacity: .6; cursor: default; }
    #acct-card .lnk { background: none; border: 0; color: #1e6fd9; font-weight: 600; cursor: pointer; padding: 0; font-size: 13px; }
    #acct-card .msg { font-size: 13px; margin-top: 10px; min-height: 18px; }
    #acct-card .msg.err { color: #b91c1c; } #acct-card .msg.ok { color: #047857; }
    #acct-card .fine { font-size: 11.5px; color: #64748b; margin-top: 12px; text-align: center; }
    #acct-card .x { position: absolute; top: 10px; right: 12px; background: none; border: 0; color: #fff; font-size: 24px; line-height: 1; cursor: pointer; opacity: .85; }
    #acct-toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 5001; background: #0f172a; color: #fff; padding: 11px 18px;
        border-radius: 10px; font: 600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,.3); display: none; }
    #acct-toast.on { display: block; }
    .acct-pro { display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: .06em; background: #f59e0b; color: #fff; border-radius: 999px; padding: 1px 7px; margin-left: 4px; }
    #acct-up { position: fixed; inset: 0; z-index: 5000; background: rgba(15,23,42,.55); display: none; align-items: center; justify-content: center; padding: 16px; }
    #acct-up.open { display: flex; }
    #acct-up .card { position: relative; background: #fff; width: 100%; max-width: 440px; max-height: 94vh; overflow: auto; border-radius: 14px; box-shadow: 0 24px 60px rgba(0,0,0,.35);
        font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #334155; }
    #acct-up .top { background: linear-gradient(135deg, #0b3a82, #1e6fd9); padding: 16px 24px 14px; color: #fff; text-align: center; }
    #acct-up .top img { height: 58px; width: auto; background: #fff; border-radius: 8px; padding: 4px 8px; margin-bottom: 8px; }
    #acct-up h3 { margin: 0; font-size: 19px; } #acct-up .top p { margin: 6px 0 0; font-size: 13px; opacity: .9; }
    #acct-up .bd { padding: 18px 24px 20px; }
    #acct-up ul { margin: 0 0 14px; padding-left: 18px; font-size: 13.5px; } #acct-up li { margin: 3px 0; }
    #acct-up .plans { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    #acct-up .plan { border: 2px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; cursor: pointer; text-align: center; background: #fff; font: inherit; color: inherit; }
    #acct-up .plan.on { border-color: #1e6fd9; background: #eff6ff; }
    #acct-up .plan b { display: block; font-size: 13px; color: #0f172a; } #acct-up .plan span { display: block; font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    #acct-up .plan i { display: block; font-style: normal; font-size: 11px; color: #047857; font-weight: 700; margin-top: 2px; min-height: 14px; }
    #acct-up .fine { font-size: 11.5px; color: #64748b; margin-top: 10px; text-align: center; }
    #acct-up .x { position: absolute; top: 10px; right: 12px; background: none; border: 0; color: #fff; font-size: 24px; line-height: 1; cursor: pointer; opacity: .85; }
    #acct-up .msg { font-size: 13px; margin-top: 8px; min-height: 16px; text-align: center; } #acct-up .msg.err { color: #b91c1c; }`;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    const ICON_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';
    const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    // ── UI ──
    function buildUI() {
        const chip = document.createElement('button'); chip.id = 'acct-chip'; chip.type = 'button';
        const menu = document.createElement('div'); menu.id = 'acct-menu';
        const modal = document.createElement('div'); modal.id = 'acct-modal';
        const toast = document.createElement('div'); toast.id = 'acct-toast';
        modal.innerHTML = `<div id="acct-card" role="dialog" aria-modal="true" aria-labelledby="acct-h">
            <button class="x" type="button" aria-label="Close">×</button>
            <div class="top"><img src="${C.logo}" alt="Data Center Water Leaks" onerror="this.remove()">
                <h3 id="acct-h">Sign in to download reports</h3>
                <p>Free account · basin, utility and site reports with CSV data</p></div>
            <div class="bd">
                <form id="acct-step1">
                    <label class="f" for="acct-email">Email</label>
                    <input type="email" id="acct-email" required autocomplete="email" placeholder="you@organization.org">
                    <label class="f" for="acct-org">Organization <span style="text-transform:none;font-weight:400">(optional)</span></label>
                    <input type="text" id="acct-org" autocomplete="organization" placeholder="Utility, agency, company, newsroom…">
                    <label class="chk"><input type="checkbox" id="acct-nl" checked> Also send me the Data Center Water Leaks newsletter</label>
                    <button class="go" type="submit">Email me a sign-in code</button>
                    <div class="msg" id="acct-msg1"></div>
                    <div style="text-align:center;margin-top:4px"><button type="button" class="lnk" id="acct-have">Already have a code?</button></div>
                </form>
                <form id="acct-step2" style="display:none">
                    <p style="margin:0 0 12px">We sent a 6-digit code to <b id="acct-sent"></b>. Enter it below, or click the link in the email.</p>
                    <label class="f" for="acct-code">Sign-in code</label>
                    <input type="text" id="acct-code" class="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="••••••">
                    <button class="go" type="submit">Sign in</button>
                    <div class="msg" id="acct-msg2"></div>
                    <div style="display:flex;justify-content:space-between;margin-top:6px"><button type="button" class="lnk" id="acct-back">← Use a different email</button><button type="button" class="lnk" id="acct-resend">Resend code</button></div>
                </form>
            </div></div>`;
        const up = document.createElement('div'); up.id = 'acct-up';
        up.innerHTML = `<div class="card" role="dialog" aria-modal="true" aria-labelledby="acct-up-h">
            <button class="x" type="button" aria-label="Close">×</button>
            <div class="top"><img src="${C.logo}" alt="Data Center Water Leaks" onerror="this.remove()">
                <h3 id="acct-up-h">Become a Pro Supporter</h3><p>Water reports, explorers, Pro map layers and print maps · funds public-records research</p></div>
            <div class="bd">
                <ul><li>Site, basin, utility and Loudoun Water reports (PDF + CSV)</li>
                    <li>Water use, drought, groundwater, wastewater and 2035 growth in one report</li>
                    <li>Pro map layers: live USGS streamgages, groundwater wells, 2035 projected sites, wastewater plants, reclaimed water and recycled water lines</li>
                    <li>Facility Explorer and Project Explorer: every FOIA'd facility and water project, searchable</li>
                    <li>Print-ready maps with your chosen layers (PDF)</li>
                    <li>Helps cover FOIA fees, hosting and new data</li></ul>
                <div class="plans">${PLANS.map((p, i) => `<button type="button" class="plan${i === PLANS.length - 1 ? ' on' : ''}" data-plan="${esc(p.id)}"><b>${esc(p.label)}</b><span>${esc(p.price)}</span><i>${esc(p.note || '')}</i></button>`).join('')}</div>
                <div id="acct-pp"></div>
                <div class="msg" id="acct-up-msg"></div>
                <div class="fine">Renews automatically until cancelled. Cancel anytime from your account menu; access continues to the end of the paid period. <a href="${window.DCWL_ROOT}pages/terms.html" target="_blank" rel="noopener" style="color:inherit">Terms &amp; Refund Policy</a></div>
            </div></div>`;
        document.body.append(chip, menu, modal, toast, up);
        selPlan = PLANS.length ? PLANS[PLANS.length - 1].id : null;
        up.addEventListener('click', e => { if (e.target === up) closeUpgrade(); });
        up.querySelector('.x').addEventListener('click', closeUpgrade);
        up.querySelectorAll('.plan').forEach(b => b.addEventListener('click', () => {
            up.querySelectorAll('.plan').forEach(x => x.classList.toggle('on', x === b)); selPlan = b.dataset.plan; renderPayPal(); }));
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && up.classList.contains('open')) { e.stopImmediatePropagation(); closeUpgrade(); } }, true);
        if (POS === 'top-right') {
            document.body.classList.add('acct-tr');
        }

        chip.addEventListener('click', e => { e.stopPropagation(); if (user) menu.classList.toggle('open'); else openModal(); });
        document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.classList.remove('open'); });
        modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
        modal.querySelector('.x').addEventListener('click', closeModal);
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) { e.stopImmediatePropagation(); closeModal(); } }, true);
        modal.querySelector('#acct-step1').addEventListener('submit', sendCode);
        modal.querySelector('#acct-step2').addEventListener('submit', verifyCode);
        modal.querySelector('#acct-back').addEventListener('click', () => step(1));
        modal.querySelector('#acct-have').addEventListener('click', () => {
            const em = $('acct-email').value.trim().toLowerCase();
            if (!em) { $('acct-msg1').className = 'msg err'; $('acct-msg1').textContent = 'Enter your email first.'; $('acct-email').focus(); return; }
            lastEmail = em; $('acct-sent').textContent = em; $('acct-code').value = ''; $('acct-msg2').textContent = ''; step(2);
        });
        modal.querySelector('#acct-resend').addEventListener('click', sendCode);
        render();
    }
    const $ = id => document.getElementById(id);
    function render() {
        const chip = $('acct-chip'); if (!chip) return;
        if (!enabled) { chip.style.display = 'none'; return; }
        chip.classList.toggle('in', !!user);
        chip.innerHTML = user ? `${ICON_USER}<span class="em">${esc(user.email)}</span>${plan.pro ? '<span class="acct-pro">PRO</span>' : ''}` : `${ICON_USER}<span>Sign in</span>`;
        chip.title = user ? 'Account' : 'Sign in for free reports';
        $('acct-menu').innerHTML = user ? `<span style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b">Signed in as</span><b>${esc(user.email)}</b>
            ${user.user_metadata && user.user_metadata.organization ? `<span>${esc(user.user_metadata.organization)}</span>` : ''}
            ${proEnabled ? (plan.pro ? `<div style="margin-top:8px;font-size:12.5px"><span class="acct-pro" style="margin:0 4px 0 0">PRO</span>Pro Supporter${plan.expires ? ` · through ${new Date(plan.expires).toLocaleDateString()}` : ''}${plan.status === 'CANCELLED' ? ' (cancelled — will not renew)' : ''}</div>${plan.status === 'ACTIVE' ? `<button type="button" id="acct-cancel">Cancel subscription</button>` : ''}`
                : `<button type="button" id="acct-upg" style="background:#1e6fd9;color:#fff;border-color:#1e6fd9">Become a Pro Supporter</button>`) : ''}
            <button type="button" id="acct-out">Sign out</button>` : '';
        const out = $('acct-out'); if (out) out.addEventListener('click', signOut);
        const upg = $('acct-upg'); if (upg) upg.addEventListener('click', () => { $('acct-menu').classList.remove('open'); openUpgrade(null, 'menu'); });
        const cx = $('acct-cancel'); if (cx) cx.addEventListener('click', e => { e.stopPropagation(); cancelSub(cx); });
        // Tell the page (map.html Pro layers). Before PayPal is configured, any signed-in member counts as Pro.
        const hasPro = !!user && (proEnabled ? plan.pro : true);
        document.body.classList.toggle('dcwl-pro', hasPro);
        window.dispatchEvent(new CustomEvent('dcwl:plan', { detail: { pro: hasPro, signedIn: !!user, known: !user || !proEnabled || !!plan.loaded } }));
    }
    // Cancel: first click asks to confirm, second click cancels in PayPal. Pro stays on until the paid period ends.
    async function cancelSub(btn) {
        if (!btn.dataset.sure) {
            btn.dataset.sure = '1'; btn.textContent = 'Confirm: stop future payments';
            btn.style.cssText = 'background:#b91c1c;color:#fff;border-color:#b91c1c';
            setTimeout(() => { if (btn.isConnected && btn.dataset.sure) { delete btn.dataset.sure; btn.textContent = 'Cancel subscription'; btn.style.cssText = ''; } }, 6000);
            return;
        }
        btn.disabled = true; btn.textContent = 'Cancelling…';
        try {
            const { data, error } = await sb.functions.invoke(PP.fn || 'paypal', { body: { action: 'cancel' } });
            if (error || (data && data.error)) throw new Error((data && data.error) || error.message);
            planP = null; await loadPlan(); render();
            toast('Subscription cancelled — Pro stays on' + (plan.expires ? ' through ' + new Date(plan.expires).toLocaleDateString() : ' until the paid period ends'), 6000);
            track('pro_cancel', {});
        } catch (e) {
            console.warn('[DCWL] cancel:', e); btn.disabled = false; delete btn.dataset.sure; btn.textContent = 'Cancel subscription'; btn.style.cssText = '';
            toast('Could not cancel right now. You can also cancel in PayPal → Settings → Automatic payments.', 7000);
        }
    }
    function toast(t, ms) { const el = $('acct-toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), ms || 4000); }
    function step(n) { $('acct-step1').style.display = n === 1 ? '' : 'none'; $('acct-step2').style.display = n === 2 ? '' : 'none';
        (n === 1 ? $('acct-email') : $('acct-code')).focus(); }
    function openModal(reason) {
        const gate = reason && reason !== 'chip';
        const TITLES = { open_page: 'Sign in to explore the data', open_report: 'Sign in to read reports', print_map: 'Sign in to print maps', kmz_download: 'Sign in to download the map', facility_explorer: 'Sign in to explore facilities', project_explorer: 'Sign in to explore projects' };
        $('acct-h').textContent = TITLES[reason] || (/^layer_/.test(reason || '') ? 'Sign in to use Pro map layers' : /^tab_/.test(reason || '') ? 'Sign in to view this data' : gate ? 'Sign in to download reports' : 'Sign in to Data Center Water Leaks');
        $('acct-card').querySelector('.top p').textContent = proEnabled && /_report$|^print_map$|^layer_|_explorer$/.test(reason || '') ? (reason === 'print_map' ? 'Sign in first — map printing is part of Pro Supporter' : /^layer_/.test(reason) ? 'Sign in first — this map layer is part of Pro Supporter' : /_explorer$/.test(reason) ? 'Sign in first — the explorers are part of Pro Supporter' : 'Sign in first — water reports are part of Pro Supporter') : 'Free account · data tabs and downloads';
        $('acct-modal').classList.add('open'); step(1); $('acct-msg1').textContent = '';
        track('signin_prompt', { reason: reason || 'chip' });
    }
    function closeModal() { $('acct-modal').classList.remove('open'); pending = null; }
    function track(n, p) { try { if (typeof window.track === 'function') window.track(n, p); else if (typeof window.gtag === 'function') window.gtag('event', n, p || {}); } catch (e) {} }

    // ── Supabase ──
    function loadSDK() {
        if (window.supabase && window.supabase.createClient) return Promise.resolve();
        return new Promise((res, rej) => { const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    }
    function init() {
        if (!enabled) { console.warn('[DCWL] Sign-in not configured (no Supabase key in account.js) — reports are open to everyone.'); return Promise.resolve(); }
        readyP = loadSDK().then(async () => {
            sb = window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
            const { data } = await sb.auth.getSession(); user = data.session ? data.session.user : null; render();
            if (user) loadPlan();
            sb.auth.onAuthStateChange((ev, session) => {
                const was = user; user = session ? session.user : null; render();
                if (user && !was) loadPlan(); if (!user) plan = { pro: false, expires: null, status: null };
                if (ev === 'SIGNED_IN' && !was && user) onSignedIn();
            });
            // magic link opened in another tab → pick up the session when the user comes back
            window.addEventListener('focus', async () => { if (!user) { const { data } = await sb.auth.getSession(); if (data.session) { user = data.session.user; render(); onSignedIn(); } } });
        }).catch(e => { console.warn('[DCWL] Could not load sign-in:', e); });
        return readyP;
    }
    function onSignedIn() {
        track('login', { method: 'email' });
        const wasOpen = $('acct-modal').classList.contains('open');
        $('acct-modal').classList.remove('open');
        const go = pending; pending = null;
        if (go) { toast('Signed in'); setTimeout(go, 150); }
        else toast(wasOpen ? (POS === 'map' ? 'Signed in — reports are unlocked' : 'Signed in — map reports are unlocked') : 'Signed in as ' + user.email);
    }
    let lastEmail = '';
    async function sendCode(e) {
        if (e) e.preventDefault();
        const email = ($('acct-email').value || lastEmail).trim().toLowerCase(); if (!email) return;
        const org = $('acct-org').value.trim(), nl = $('acct-nl').checked;
        const btn = $('acct-step1').querySelector('.go'), msg = $('acct-msg1');
        btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Sending…';
        try {
            await readyP;
            const redirect = location.origin + location.pathname;
            const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: true, data: { organization: org || null, newsletter: nl, signup_page: location.pathname } } });
            if (error) throw error;
            lastEmail = email;
            if (nl && C.newsletterForm) { const f = new FormData(); f.append(C.newsletterFields.email, email); f.append(C.newsletterFields.source, 'Map sign-in');
                fetch(C.newsletterForm, { method: 'POST', mode: 'no-cors', body: f }).catch(() => {}); }
            $('acct-sent').textContent = email; $('acct-code').value = ''; $('acct-msg2').textContent = ''; step(2);
            track('signin_code_sent', {});
        } catch (err) {
            msg.className = 'msg err';
            const em = (err.code || '') + ' ' + (err.message || '');
            msg.textContent = /over_email_send_rate_limit|email rate limit/i.test(em) ? 'Too many emails sent. Please try again later.'
                : /seconds|over_request_rate_limit|rate/i.test(em) ? 'Please wait a minute and try again.'
                : 'Could not send the email. Check the address and try again.';
            console.warn('[DCWL] signInWithOtp:', err);
        } finally { btn.disabled = false; if (msg.textContent === 'Sending…') msg.textContent = ''; }
    }
    async function verifyCode(e) {
        e.preventDefault();
        const token = $('acct-code').value.replace(/\D/g, ''), msg = $('acct-msg2'), btn = $('acct-step2').querySelector('.go');
        if (token.length < 6) { msg.className = 'msg err'; msg.textContent = 'Enter the code from the email.'; return; }
        btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Checking…';
        const { error } = await sb.auth.verifyOtp({ email: lastEmail, token, type: 'email' });
        btn.disabled = false;
        if (error) { msg.className = 'msg err'; msg.textContent = 'That code is invalid or expired. Request a new one.'; return; }
        msg.textContent = '';
    }
    async function signOut() { $('acct-menu').classList.remove('open'); await sb.auth.signOut(); user = null; render(); toast('Signed out'); track('logout', {}); }

    // ── Pro Supporter (PayPal) ──
    function loadPlan() {
        if (!sb || !user || !proEnabled) return Promise.resolve(plan);
        try { planP = sb.from('members').select('plan, plan_expires, plan_status').eq('user_id', user.id).maybeSingle().then(({ data }) => {
            const exp = data && data.plan_expires ? Date.parse(data.plan_expires) : null;
            plan = { pro: !!(data && data.plan === 'pro' && (!exp || exp > Date.now())), expires: data && data.plan_expires, status: data && data.plan_status, loaded: true };
            render(); return plan;
        }).catch(() => plan); } catch (e) { planP = Promise.resolve(plan); }
        return planP;
    }
    function loadPayPal() {
        if (window.paypal && window.paypal.Buttons) return Promise.resolve();
        if (!ppSDK) ppSDK = new Promise((res, rej) => { const s = document.createElement('script');
            s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PP.clientId)}&vault=true&intent=subscription&components=buttons`;
            s.setAttribute('data-sdk-integration-source', 'button-factory'); s.onload = res; s.onerror = rej; document.head.appendChild(s); });
        return ppSDK;
    }
    async function renderPayPal() {
        const box = $('acct-pp'), msg = $('acct-up-msg'); if (!box) return;
        box.innerHTML = '<p style="text-align:center;color:#64748b;font-size:13px">Loading PayPal…</p>'; msg.textContent = ''; msg.className = 'msg';
        try { await loadPayPal(); } catch (e) { box.innerHTML = ''; msg.className = 'msg err'; msg.textContent = 'PayPal could not load. Check your connection or ad blocker and try again.'; return; }
        box.innerHTML = '';
        window.paypal.Buttons({
            style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'subscribe' },
            createSubscription: (d, actions) => actions.subscription.create({ plan_id: selPlan, custom_id: user.id,
                application_context: { brand_name: 'Data Center Water Leaks', shipping_preference: 'NO_SHIPPING', user_action: 'SUBSCRIBE_NOW' } }),
            onApprove: async d => {
                msg.className = 'msg'; msg.textContent = 'Activating your Pro Supporter account…';
                track('pro_subscribe', { plan: selPlan });
                try { const { data, error } = await sb.functions.invoke(PP.fn || 'paypal', { body: { subscriptionID: d.subscriptionID } }); if (error || (data && data.error)) throw new Error((data && data.error) || error.message); } catch (e) { console.warn('[DCWL] activation:', e); }
                await loadPlan();
                if (plan.pro) { closeUpgrade(true); toast('Thank you — you are now a Pro Supporter'); const go = proPending; proPending = null; if (go) setTimeout(go, 200); }
                else { msg.className = 'msg err'; msg.textContent = 'Payment received — activation is taking a moment. Please refresh the page in a minute, or email datacenterwaterleaks@gmail.com.'; }
            },
            onError: err => { console.warn('[DCWL] PayPal:', err); msg.className = 'msg err'; msg.textContent = 'PayPal reported a problem. Please try again.'; }
        }).render('#acct-pp');
    }
    function openUpgrade(fn, reason) { proPending = fn || null; $('acct-up').classList.add('open'); renderPayPal(); track('pro_prompt', { reason: reason || 'menu' }); }
    function closeUpgrade(keep) { $('acct-up').classList.remove('open'); if (!keep) proPending = null; }

    // ── public API used by map.html ──
    // requirePro(fn): Pro Supporters run fn; signed-out visitors sign in first; free members see the upgrade window.
    // Until PayPal is configured in this file, it behaves like requireAuth (free sign-in).
    window.dcwlRequirePro = async function (fn, reason) {
        if (!enabled) return fn();
        await readyP;
        if (!sb) return fn();
        if (!proEnabled) return window.dcwlRequireAuth(fn, reason);
        if (!user) { pending = () => window.dcwlRequirePro(fn, reason); openModal(reason); return; }
        await (planP || loadPlan());
        if (plan.pro) return fn();
        openUpgrade(fn, reason);
    };
    window.dcwlIsPro = () => plan.pro;
    // requireAuth(fn): run fn now if signed in (or sign-in not configured); otherwise ask to sign in, then run it.
    window.dcwlRequireAuth = async function (fn, reason) {
        if (!enabled) return fn();
        await readyP;
        if (!sb) return fn();                 // SDK failed to load → don't block the site
        if (user) return fn();
        pending = fn; openModal(reason);
    };
    // logReport(event, params): record report activity in Supabase (email is filled in server-side from the session)
    window.dcwlLogReport = function (event, p) {
        if (!enabled || !sb || !user) return;
        p = p || {};
        sb.from('report_log').insert({
            event, report_type: p.report_type || event.replace(/_report_.*/, ''), format: p.format || (/_open$/.test(event) ? 'view' : null),
            area_id: p.huc8 || p.pwsid || null, area_name: p.basin_name || p.utility_name || null,
            operator: p.operator || null, dataset: p.dataset || null, page: location.pathname
        }).then(({ error }) => { if (error) console.warn('[DCWL] report log:', error.message); });
    };
    window.dcwlUser = () => user;

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { buildUI(); init(); });
    else { buildUI(); init(); }
})();
