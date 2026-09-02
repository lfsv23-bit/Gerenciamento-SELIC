// Autenticacao Supabase para paginas estaticas no GitHub Pages.
// Usa apenas Project URL e Publishable Key no navegador.

(() => {
  const LOGIN_PAGE = "login.html";
  const HOME_PAGE = "index.html";

  function supabaseConfigured() {
    return !!window.isSupabaseConfigured?.();
  }

  function createClient() {
    if (!supabaseConfigured()) {
      throw new Error("Supabase nao configurado. Preencha js/supabase-config.js.");
    }
    if (!window.supabase?.createClient) {
      throw new Error("Biblioteca Supabase Auth nao carregada.");
    }
    if (!window.__supabaseClient) {
      const cfg = window.SUPABASE_CONFIG;
      window.__supabaseClient = window.supabase.createClient(cfg.url, cfg.publishableKey, {
        db: { schema: cfg.schema || "public" }
      });
    }
    return window.__supabaseClient;
  }

  function currentPage() {
    return String(location.pathname.split("/").pop() || HOME_PAGE).toLowerCase();
  }

  function goToLogin() {
    const next = encodeURIComponent(location.pathname.split("/").pop() || HOME_PAGE);
    location.href = `${LOGIN_PAGE}?next=${next}`;
  }

  function goToHome() {
    const params = new URLSearchParams(location.search);
    const next = params.get("next") || HOME_PAGE;
    location.href = next === LOGIN_PAGE ? HOME_PAGE : next;
  }

  async function requireAuth() {
    if (currentPage() === LOGIN_PAGE) return null;
    const client = createClient();
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session) {
      goToLogin();
      return null;
    }
    return data.session;
  }

  async function login(email, password) {
    const client = createClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    goToHome();
  }

  async function logout() {
    const client = createClient();
    await client.auth.signOut();
    location.href = LOGIN_PAGE;
  }

  function bindLogoutButton() {
    const btn = document.getElementById("btn_logout");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await logout();
      } catch (error) {
        console.error(error);
        alert("Nao foi possivel sair agora.");
        btn.disabled = false;
      }
    });
  }

  async function initLoginPage() {
    const form = document.getElementById("login_form");
    if (!form) return;
    const status = document.getElementById("login_status");
    const email = document.getElementById("login_email");
    const password = document.getElementById("login_password");
    const submit = document.getElementById("login_submit");

    try {
      const client = createClient();
      const { data } = await client.auth.getSession();
      if (data?.session) goToHome();
    } catch (error) {
      if (status) status.textContent = error.message || String(error);
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (status) status.textContent = "Entrando...";
      if (submit) submit.disabled = true;
      try {
        await login(email.value.trim(), password.value);
      } catch (error) {
        if (status) status.textContent = "E-mail ou senha invalidos.";
        if (submit) submit.disabled = false;
      }
    });
  }

  window.AppAuth = {
    client: createClient,
    requireAuth,
    login,
    logout
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindLogoutButton();
    initLoginPage();
  });

  if (currentPage() !== LOGIN_PAGE) {
    requireAuth().catch((error) => {
      console.error(error);
      goToLogin();
    });
  }
})();
