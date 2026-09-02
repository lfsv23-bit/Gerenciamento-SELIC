// Configuracao publica do Supabase para GitHub Pages.
// Preencha estes valores depois de criar o projeto no Supabase.
// NUNCA coloque a service_role key neste arquivo.

window.SUPABASE_CONFIG = {
  url: "https://pdqnwebswjszulxcvxel.supabase.co",
  publishableKey: "sb_publishable_jlEk5LidiX6wjvbefxjLTQ_xb8BwnFI",
  schema: "public"
};

window.isSupabaseConfigured = function isSupabaseConfigured() {
  const cfg = window.SUPABASE_CONFIG || {};
  return /^https:\/\/.+\.supabase\.co$/i.test(cfg.url || "") && !!cfg.publishableKey;
};
