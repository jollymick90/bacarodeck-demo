import re,html,json
from pathlib import Path
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
from urllib.request import urlopen
with urlopen('https://sessionize.com/api/v2/t79hj390/view/GridSmart?under=True', timeout=30) as response:
 s=response.read().decode('utf-8')
rows=[]
from html.parser import HTMLParser
class Sessions(HTMLParser):
 def __init__(self):
  super().__init__(); self.depth=0; self.blocks=[]; self.current=[]
 def handle_starttag(self,tag,attrs):
  if tag == 'div' and 'data-sessionid' in dict(attrs) and not self.depth:
   self.depth=1; self.current=[dict(attrs)['data-sessionid']+'"']; return
  if self.depth:
   self.current.append(self.get_starttag_text())
   if tag=='div': self.depth+=1
 def handle_endtag(self,tag):
  if self.depth:
   self.current.append('</'+tag+'>')
   if tag=='div':
    self.depth-=1
    if not self.depth:self.blocks.append(''.join(self.current))
 def handle_data(self,data):
  if self.depth:self.current.append(data)
parser=Sessions();parser.feed(s)
for block in parser.blocks:
 times=re.search(r'TimeWithDuration\|en-US\|([^|]+)\|([^" ]+)',block)
 names=re.findall(r'<li data-speakerid="[^"]+">\s*<a[^>]+>(.*?)</a>',block)
 if not times or not names: continue
 start,end=[datetime.fromisoformat(re.sub(r'\.0+', '', x).replace('Z','+00:00')).astimezone(ZoneInfo('Europe/Rome')) for x in times.groups()]
 title=re.search(r'<h3 class="sz-session__title">\s*<a[^>]+>(.*?)</a>',block)
 rows.append({'sessionId':block.split('"')[0],'speakers':[html.unescape(re.sub('<[^>]+>','',n)) for n in names],'title':html.unescape(title[1]) if title else '', 'startsAt':start.isoformat(),'endsAt':end.isoformat()})

path=Path(__file__).resolve().parents[1]/'data/agenda/codemotion.json'
current=json.loads(path.read_text())
if not rows: raise RuntimeError('Agenda vuota: snapshot esistente conservato')
current['sessions']=rows
current['retrievedOn']=datetime.now(ZoneInfo('Europe/Rome')).date().isoformat()
path.write_text(json.dumps(current,ensure_ascii=False,indent=2)+'\n')
print(f'Aggiornate {len(rows)} sessioni nello snapshot locale. Rivedere il diff prima del deploy. Slot originali preservati; nessuna scrittura su Firebase.')
