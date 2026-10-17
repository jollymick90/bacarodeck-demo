#!/usr/bin/env python3
"""Validate a standalone package. Run: python3 scripts/validate_package.py"""
import json
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
M=json.loads((ROOT/'manifest.json').read_text())
assert len(M['speakers'])==84
assert sum(s['group']=='in' for s in M['speakers'])==29
assert sum(s['group']=='out' for s in M['speakers'])==55
assert len({s['speakerId'] for s in M['speakers']})==84
GROUPS={'in':'01_speaker_in_elenco','out':'02_speaker_fuori_elenco'}
for s in M['speakers']:
    folder=ROOT/s['path']
    assert folder.parent.name==GROUPS[s['group']],folder
    assert (folder/'scheda.md').exists(),folder
    b=json.loads((folder/'import.json').read_text())
    assert len(b['speakers'])==len(b['talks'])==len(b['interviewPlans'])==1,folder
    assert b['speakers'][0]['id']==s['speakerId'],folder
    assert b['speakers'][0]['tags']==[],folder
    assert b['speakers'][0]['suggestedTags']==[],folder
    assert b['talks'][0]['topic'] is None,folder
    assert b['questions']==b['insights']==b['materials']==[],folder
    assert not re.search(r'[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}',(folder/'import.json').read_text(),re.I),folder
for rel,n in [('import/01_speaker_in_elenco.json',29),('import/02_speaker_fuori_elenco.json',55),('import/00_tutti_gli_speaker.json',84)]:
    x=json.loads((ROOT/rel).read_text());assert len(x['speakers'])==len(x['talks'])==len(x['interviewPlans'])==n,rel
    assert x['questions']==x['insights']==x['materials']==[],rel
print('VALID: 84 cartelle, 29 in elenco, 55 fuori, import coerenti; nessun topic o domanda precompilata.')
