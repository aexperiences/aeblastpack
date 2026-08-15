import { getToken } from './_tt.mjs';

export default async function handler(req, res){
  const tok = await getToken(req, res);
  if (!tok) return res.status(200).json({ connected: false });
  res.status(200).json({ connected: true, name: tok.name, avatar: tok.avatar });
}
