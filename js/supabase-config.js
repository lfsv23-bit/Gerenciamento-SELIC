// Configuracao publica do Supabase para GitHub Pages.
// Preencha estes valores depois de criar o projeto no Supabase.
// NUNCA coloque a service_role key neste arquivo.

window.SUPABASE_CONFIG = {
  url: "",
  publishableKey: "",
  schema: "public"
};

window.isSupabaseConfigured = function isSupabaseConfigured() {
  const cfg = window.SUPABASE_CONFIG || {};
  return /^https:\/\/.+\.supabase\.co$/i.test(cfg.url || "") && !!cfg.publishableKey;
};
