import axios from 'axios';

const PUBMED_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const PUBMED_TOOL = 'Threshold';
const PUBMED_EMAIL = process.env.NCBI_CONTACT_EMAIL || 'support@mythreshold.co';

function buildPubMedParams(extra = {}) {
  return {
    tool: PUBMED_TOOL,
    email: PUBMED_EMAIL,
    ...extra,
  };
}

function buildPubMedUrl(pmid) {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

export async function searchPubMed(query, retmax = 8) {
  const response = await axios.get(`${PUBMED_BASE_URL}/esearch.fcgi`, {
    params: buildPubMedParams({
      db: 'pubmed',
      retmode: 'json',
      retmax,
      term: query,
    }),
  });

  return response.data?.esearchresult?.idlist || [];
}

export async function summarizePubMed(pmids = []) {
  if (!pmids.length) return [];

  const response = await axios.get(`${PUBMED_BASE_URL}/esummary.fcgi`, {
    params: buildPubMedParams({
      db: 'pubmed',
      retmode: 'json',
      id: pmids.join(','),
    }),
  });

  const result = response.data?.result || {};
  const uids = result.uids || [];

  return uids.map((uid) => {
    const item = result[uid];
    const authors = (item?.authors || [])
      .map((author) => author.name)
      .filter(Boolean)
      .join(', ');
    const yearMatch = (item?.pubdate || '').match(/\d{4}/);
    const sortPubDate = item?.sortpubdate ? item.sortpubdate.slice(0, 10) : null;

    return {
      pubmed_id: uid,
      title: item?.title || 'Untitled study',
      authors,
      journal: item?.fulljournalname || item?.source || null,
      publication_year: yearMatch ? parseInt(yearMatch[0], 10) : null,
      publication_date: sortPubDate || null,
      pubmed_url: buildPubMedUrl(uid),
    };
  });
}
