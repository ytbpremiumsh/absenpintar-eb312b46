import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface SchoolData {
  npsn: string;
  name: string;
  address: string;
  level: string;
  status: string;
  district: string;
  province: string;
}

const timedFetch = async (url: string, ms = 6000): Promise<Response | null> => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ATSkolla-NPSN-Lookup/1.0)',
        'Accept': 'application/json,text/html;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(t);
    return res;
  } catch (e) {
    console.log('fetch failed', url, (e as Error).message);
    return null;
  }
};

// Source 1: fazriansyah mirror (fastest, JSON)
const tryFazriansyah = async (npsn: string): Promise<SchoolData | null> => {
  const res = await timedFetch(`https://api.fazriansyah.eu.org/v1/sekolah?npsn=${npsn}`);
  if (!res?.ok) return null;
  const json = await res.json().catch(() => null);
  const sp = json?.data?.satuanPendidikan;
  if (!sp?.nama) return null;
  return {
    npsn: sp.npsn || npsn,
    name: sp.nama,
    address: sp.alamat || '',
    level: sp.jenjang || '',
    status: sp.status || '',
    district: sp.kabupatenKota || '',
    province: sp.propinsi || '',
  };
};

// Source 2: api-sekolah-indonesia (community mirror of Dapodik)
const tryApiSekolahId = async (npsn: string): Promise<SchoolData | null> => {
  const res = await timedFetch(`https://api-sekolah-indonesia.vercel.app/sekolah?npsn=${npsn}`);
  if (!res?.ok) return null;
  const json = await res.json().catch(() => null);
  const s = Array.isArray(json?.dataSekolah) ? json.dataSekolah[0] : null;
  if (!s?.sekolah) return null;
  return {
    npsn: s.npsn || npsn,
    name: s.sekolah,
    address: s.alamat_jalan || '',
    level: s.bentuk_pendidikan_id || '',
    status: s.status_sekolah || '',
    district: s.kabupaten_kota || '',
    province: s.propinsi || '',
  };
};

// Source 3: Dapodik official search endpoint
const tryDapodikSearch = async (npsn: string): Promise<SchoolData | null> => {
  const res = await timedFetch(`https://api-dapodik.kemdikbud.go.id/rekap/getSekolahByNPSN?npsn=${npsn}`);
  if (!res?.ok) return null;
  const json = await res.json().catch(() => null);
  const s = Array.isArray(json) ? json[0] : json?.data?.[0] || json?.data;
  if (!s) return null;
  const name = s.nama || s.sekolah || s.nama_sekolah;
  if (!name) return null;
  return {
    npsn: s.npsn || npsn,
    name,
    address: s.alamat || s.alamat_jalan || '',
    level: s.bentuk || s.jenjang || s.bentuk_pendidikan || '',
    status: s.status || s.status_sekolah || '',
    district: s.kabupaten_kota || s.kabupatenKota || s.kabupaten || '',
    province: s.propinsi || s.provinsi || '',
  };
};

// Source 4: Legacy dapo.kemdikbud fallback
const tryLegacyDapo = async (npsn: string): Promise<SchoolData | null> => {
  const res = await timedFetch(`https://dapo.kemdikbud.go.id/api/getHasilPencarian?keyword=${npsn}`);
  if (!res?.ok) return null;
  const json = await res.json().catch(() => null);
  const s = Array.isArray(json) ? json[0] : null;
  if (!s) return null;
  return {
    npsn: s.npsn || npsn,
    name: s.nama || s.sekolah || '',
    address: s.alamat || '',
    level: s.bentuk || '',
    status: s.status || '',
    district: s.kabupaten_kota || '',
    province: s.propinsi || '',
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const npsn = (url.searchParams.get('npsn') || '').trim();

    if (!/^\d{8}$/.test(npsn)) {
      return new Response(JSON.stringify({ error: 'NPSN harus 8 digit angka' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try all sources in order; return first hit
    const sources: Array<{ name: string; fn: () => Promise<SchoolData | null> }> = [
      { name: 'fazriansyah', fn: () => tryFazriansyah(npsn) },
      { name: 'api-sekolah-id', fn: () => tryApiSekolahId(npsn) },
      { name: 'dapodik-official', fn: () => tryDapodikSearch(npsn) },
      { name: 'dapo-legacy', fn: () => tryLegacyDapo(npsn) },
    ];

    for (const src of sources) {
      try {
        const data = await src.fn();
        if (data && data.name) {
          return new Response(JSON.stringify({ success: true, school: data, source: src.name }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {
        console.log(`source ${src.name} failed:`, (e as Error).message);
      }
    }

    return new Response(JSON.stringify({
      error: 'Sekolah dengan NPSN tersebut tidak ditemukan di database Dapodik. Silakan isi data secara manual.',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
