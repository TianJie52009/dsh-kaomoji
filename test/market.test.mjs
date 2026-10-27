import assert from 'node:assert/strict';
import test from 'node:test';
import { marketStatus } from '../scripts/sync-market.mjs';

test('market sync distinguishes catalog freshness, repo age, and release age', () => {
  const now=Date.parse('2026-10-27T12:00:00Z');
  const facts={version:'0.3.0',catalogVersion:'0.2.0',createdAt:'2026-09-01T00:00:00Z',publishedAt:'2026-10-27T11:00:00Z'};
  assert.equal(marketStatus(facts,now).repoReady,true);
  assert.equal(marketStatus(facts,now).releaseReady,false);
  assert.equal(marketStatus(facts,now).synced,false);
  assert.equal(marketStatus(facts,now+86400000).releaseReady,true);
  assert.equal(marketStatus({...facts,catalogVersion:'0.3.0'},now).synced,true);
  assert.throws(()=>marketStatus({...facts,publishedAt:null},now));
});
