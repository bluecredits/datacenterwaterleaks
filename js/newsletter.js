/* Data Center Water Leaks — newsletter pop-up, shared by every page.
   Include near the end of <body>:
     <script src="newsletter.js"></script>                       (button only)
     <script src="newsletter.js" data-autoshow="true"></script>  (also opens on landing — index.html)
   Any element with onclick="nlOpen('footer')" opens the pop-up. */
(function () {
    const ROOT = (document.currentScript && document.currentScript.src ? new URL('../', document.currentScript.src).href : '/');
    const AUTOSHOW = !!(document.currentScript && document.currentScript.dataset.autoshow === 'true');

    /* ── NEWSLETTER SETTINGS ─────────────────────────────────────────
       Connect to your Google Form (one place for the whole site):
         formId  = the long ID in the form's share link  …/forms/d/e/<formId>/viewform
         fields  = the entry.NNNN IDs for each question (from a pre-filled link)
       Until formId is filled in, Subscribe opens an email to the address below instead. */
    window.NEWSLETTER = {
        formId: '1FAIpQLSfcyUigbpBRD_7Ctpx82_PTX9rwhuDIpxLXjthgpMsrQSFzCA',   // Google Form "Newsletter"
        fields: { email: 'entry.67463075', source: 'entry.1205237035' },   // e.g. 'entry.123456789'
        fallbackEmail: 'datacenterwaterleaks@gmail.com',
        showDelayMs: 1500,                        // pop-up appears this long after landing
        snoozeDays: 14                            // after "Maybe later"/close, wait this long before showing again
    };


    const CSS = `        /* ── NEWSLETTER POP-UP ─────────────────────────────── */
        .nl-open-btn { display: inline-flex; align-items: center; gap: 8px; margin-top: 4px; padding: 9px 18px; border-radius: 999px; border: 1px solid #fecaca; background: #fff; color: #d32f2f; font-weight: 700; font-size: 0.9rem; cursor: pointer; font-family: inherit; transition: background .2s, transform .2s; }
        .nl-open-btn:hover { background: #fef2f2; transform: translateY(-1px); }
        #nl-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(15,23,42,.55); backdrop-filter: blur(3px); display: none; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; }
        #nl-overlay.open { display: flex; animation: nlFade .25s ease-out; }
        .nl-card { position: relative; width: 420px; max-width: 100%; max-height: calc(100vh - 32px); overflow-y: auto; background: #fff; border-radius: 20px; border-top: 5px solid #d32f2f; box-shadow: 0 30px 70px rgba(0,0,0,.35); animation: nlUp .3s ease-out; box-sizing: border-box; }
        .nl-top { background: #fff; color: #1e293b; padding: 28px 30px 6px; text-align: center; }
        .nl-top img { width: 96px; height: 96px; object-fit: contain; background: #fff; border-radius: 50%; padding: 10px; box-sizing: border-box; border: 1px solid #ddd; box-shadow: 0 4px 10px rgba(0,0,0,.05); }
        .nl-kicker { margin-top: 12px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #64748b; font-weight: 700; }
        .nl-top h2 { color: #0f172a; font-size: 1.45rem; margin: 6px 0 6px; line-height: 1.25; }
        .nl-top p { margin: 0; color: #64748b; font-size: .93rem; line-height: 1.5; }
        .nl-body { padding: 22px 30px 26px; }
        .nl-points { list-style: none; padding: 0; margin: 0 0 18px; display: grid; gap: 7px; font-size: .88rem; color: #334155; }
        .nl-points li { display: flex; gap: 9px; align-items: flex-start; }
        .nl-points li::before { content: ''; flex: none; width: 16px; height: 16px; margin-top: 2px; border-radius: 50%; background: #d1fae5 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8.5l2.5 2.5L12 5.5' fill='none' stroke='%23059669' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/12px no-repeat; }
        .nl-form { display: grid; gap: 10px; }
        .nl-form label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #64748b; display: grid; gap: 4px; }
        .nl-form input, .nl-form select { font: inherit; font-size: .95rem; text-transform: none; letter-spacing: 0; font-weight: 400; color: #0f172a; padding: 11px 13px; border: 1.5px solid #cbd5e1; border-radius: 10px; outline: none; background: #fff; transition: border-color .15s, box-shadow .15s; width: 100%; box-sizing: border-box; }
        .nl-form input:focus, .nl-form select:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,.18); }
        .nl-inline { display: flex; gap: 8px; }
        .nl-inline input { flex: 1; min-width: 0; }
        .nl-inline .nl-submit { margin-top: 0; padding: 0 20px; white-space: nowrap; }
        .nl-sr { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
        .nl-hp { position: absolute !important; left: -9999px !important; width: 1px; height: 1px; opacity: 0; }
        .nl-submit { margin-top: 4px; padding: 13px; border: 0; border-radius: 6px; background: #d32f2f; color: #fff; font: inherit; font-weight: 800; font-size: 1rem; cursor: pointer; transition: background .15s, transform .15s; }
        .nl-submit:hover { background: #b71c1c; transform: translateY(-1px); }
        .nl-submit[disabled] { opacity: .6; cursor: default; transform: none; }
        .nl-fine { font-size: .75rem; color: #94a3b8; text-align: center; margin: 10px 0 0; line-height: 1.5; }
        .nl-later { display: block; margin: 12px auto 0; background: none; border: 0; color: #64748b; font: inherit; font-size: .85rem; cursor: pointer; text-decoration: underline; }
        .nl-x { position: absolute; top: 12px; right: 14px; width: 34px; height: 34px; border-radius: 50%; border: 0; background: #f1f5f9; color: #64748b; font-size: 22px; line-height: 1; cursor: pointer; }
        .nl-x:hover { background: #e2e8f0; color: #0f172a; }
        .nl-msg:empty { display: none; }
        .nl-msg { font-size: .85rem; margin: 2px 0 0; min-height: 1em; color: #b91c1c; }
        .nl-done { text-align: center; padding: 10px 0 6px; display: none; }
        .nl-done .nl-check { width: 58px; height: 58px; margin: 0 auto 12px; border-radius: 50%; background: #d1fae5; display: grid; place-items: center; }
        .nl-done h3 { margin: 0 0 6px; color: #0f172a; }
        .nl-done p { margin: 0 0 14px; color: #64748b; font-size: .92rem; }
        .nl-card.sent .nl-form, .nl-card.sent .nl-points, .nl-card.sent .nl-later, .nl-card.sent .nl-fine { display: none; }
        .nl-card.sent .nl-done { display: block; }
        @keyframes nlFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nlUp { from { opacity: 0; transform: translateY(18px) scale(.98); } to { opacity: 1; transform: none; } }
        @media (max-width: 480px) { .nl-inline { flex-direction: column; } .nl-inline .nl-submit { padding: 12px; } .nl-top, .nl-body { padding-left: 20px; padding-right: 20px; } }
        @media (prefers-reduced-motion: reduce) { #nl-overlay.open, .nl-card { animation: none; } }
`;
    const HTML = `    <!-- NEWSLETTER POP-UP -->
    <div id="nl-overlay" role="dialog" aria-modal="true" aria-labelledby="nl-title" aria-hidden="true">
        <div class="nl-card" id="nl-card">
            <button type="button" class="nl-x" id="nl-x" aria-label="Close">×</button>
            <div class="nl-top">
                <img src="${ROOT}logo.png" alt="">
                <h2 id="nl-title">Stay in the loop</h2>
                <p>Receive our newsletter and updates on data center water use.</p>
            </div>
            <div class="nl-body">
                <form class="nl-form" id="nl-form" novalidate>
                    <label for="nl-email" class="nl-sr">Email address</label>
                    <div class="nl-inline">
                        <input type="email" id="nl-email" name="email" autocomplete="email" placeholder="Your email address" required>
                        <button type="submit" class="nl-submit" id="nl-submit">Subscribe</button>
                    </div>
                    <input type="text" class="nl-hp" id="nl-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
                    <p class="nl-msg" id="nl-msg" role="alert"></p>
                </form>
                <button type="button" class="nl-later" id="nl-later">Maybe later</button>
                <div class="nl-done" aria-live="polite">
                    <div class="nl-check"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
                    <h3>You're subscribed</h3>
                    <p>Thanks! Watch your inbox for our next update.</p>
                    <button type="button" class="nl-submit" style="width:100%;background:#10b981" onclick="nlClose()">Back to the site</button>
                </div>
            </div>
        </div>
    </div>

`;

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    function init() {
        const $ = id => document.getElementById(id);
        const store = {
            get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
            set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
        };
        const track = (name, params) => { try { if (typeof gtag === 'function') gtag('event', name, params || {}); } catch (e) {} };
        let lastFocus = null, openedFrom = 'auto';

        window.nlOpen = function (from) {
            openedFrom = from || 'auto';
            lastFocus = document.activeElement;
            $('nl-overlay').classList.add('open');
            $('nl-overlay').setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            setTimeout(() => ($('nl-card').classList.contains('sent') ? null : $('nl-email').focus()), 50);
            track('newsletter_popup_view', { trigger: openedFrom });
        };
        window.nlClose = function (snooze) {
            $('nl-overlay').classList.remove('open');
            $('nl-overlay').setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            if (snooze && !store.get('dcwl_nl_subscribed')) store.set('dcwl_nl_snooze_until', String(Date.now() + NEWSLETTER.snoozeDays * 864e5));
            if (lastFocus && lastFocus.focus) lastFocus.focus();
        };

        $('nl-x').addEventListener('click', () => nlClose(true));
        $('nl-later').addEventListener('click', () => { track('newsletter_dismiss', { trigger: openedFrom }); nlClose(true); });
        $('nl-overlay').addEventListener('click', e => { if (e.target.id === 'nl-overlay') nlClose(true); });
        document.addEventListener('keydown', e => {
            if (!$('nl-overlay').classList.contains('open')) return;
            if (e.key === 'Escape') nlClose(true);
            if (e.key === 'Tab') {   // keep focus inside the pop-up
                const f = [...$('nl-card').querySelectorAll('button, input:not(.nl-hp), select, a[href]')].filter(el => el.offsetParent !== null);
                if (!f.length) return;
                if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
                else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
            }
        });

        $('nl-form').addEventListener('submit', async e => {
            e.preventDefault();
            const email = $('nl-email').value.trim(), name = '', role = '';
            $('nl-msg').textContent = '';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { $('nl-msg').textContent = 'Please enter a valid email address.'; $('nl-email').focus(); return; }
            if ($('nl-hp').value) return;   // bot filled the hidden field

            if (!NEWSLETTER.formId || !NEWSLETTER.fields.email) {
                // Not connected yet: fall back to an email so no sign-up is lost
                const body = `Please add me to the Data Center Water Leaks newsletter.%0D%0A%0D%0AEmail: ${encodeURIComponent(email)}`;
                window.location.href = `mailto:${NEWSLETTER.fallbackEmail}?subject=${encodeURIComponent('Newsletter sign-up')}&body=${body}`;
                return;
            }
            const btn = $('nl-submit'); btn.disabled = true; btn.textContent = 'Subscribing…';
            const fd = new FormData();
            fd.append(NEWSLETTER.fields.email, email);
            if (NEWSLETTER.fields.name && name) fd.append(NEWSLETTER.fields.name, name);
            if (NEWSLETTER.fields.role && role) fd.append(NEWSLETTER.fields.role, role);
            if (NEWSLETTER.fields.source) fd.append(NEWSLETTER.fields.source, 'Landing page pop-up (' + openedFrom + ')');
            try {
                // Google Forms doesn't return CORS headers, so the response is opaque; a network error is the only failure we can see
                await fetch(`https://docs.google.com/forms/d/e/${NEWSLETTER.formId}/formResponse`, { method: 'POST', mode: 'no-cors', body: fd });
                store.set('dcwl_nl_subscribed', '1');
                $('nl-card').classList.add('sent');
                track('newsletter_signup', { trigger: openedFrom });
            } catch (err) {
                $('nl-msg').textContent = `Something went wrong. Please try again, or email ${NEWSLETTER.fallbackEmail}.`;
            } finally { btn.disabled = false; btn.textContent = 'Subscribe'; }
        });

        // Show on landing unless the visitor already subscribed or recently dismissed it
        if (AUTOSHOW) window.addEventListener('load', () => {
            if (store.get('dcwl_nl_subscribed')) return;
            if (Date.now() < Number(store.get('dcwl_nl_snooze_until') || 0)) return;
            setTimeout(() => nlOpen('auto'), NEWSLETTER.showDelayMs);
        });
    }

    function mount() {
        document.body.insertAdjacentHTML('beforeend', HTML);
        init();
    }
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
