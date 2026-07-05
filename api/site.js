import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send('<h1>Lien invalide</h1><p>Identifiant de site manquant.</p>');
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const { data, error } = await supabase
    .from('projects')
    .select('html, name')
    .eq('id', parseInt(id))
    .single();

  if (error || !data || !data.html) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send('<h1>Site introuvable</h1><p>Ce lien ne correspond à aucun site publié.</p>');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(data.html);
}
