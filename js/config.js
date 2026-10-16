// Public client settings. The anon key is designed to be shipped to browsers; row-level security protects the data.
(function (root) {
  const CC = (root.CC = root.CC || {});
  CC.CONFIG = {
    supabaseUrl: 'https://khisyazijnxpmszkbkmb.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoaXN5YXppam54cG1zemtia21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMTYwNzEsImV4cCI6MjEwNzY5MjA3MX0.PF8OcH84svqiEXtGiH3uZn9oFQjH269GTpaPjKYLy4w',
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
