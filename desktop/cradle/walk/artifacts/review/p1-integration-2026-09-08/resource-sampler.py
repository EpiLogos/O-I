#!/usr/bin/env python3
"""Read-only native process evidence. Unattributed WebKit is never app memory."""
import argparse, datetime, json, pathlib, subprocess, time
parser=argparse.ArgumentParser()
parser.add_argument('--pid',type=int,required=True)
parser.add_argument('--seconds',type=int,default=60)
parser.add_argument('--output',type=pathlib.Path,required=True)
parser.add_argument('--marker',type=pathlib.Path)
parser.add_argument('--app-name',help='Exact unique acceptance application name in LaunchServices')
a=parser.parse_args()
if not 1 <= a.seconds <= 7200: parser.error('seconds must be 1..7200')
def processes():
    text=subprocess.check_output(['/bin/ps','-axo','pid=,ppid=,rss=,%cpu=,lstart=,comm='],text=True)
    rows=[]
    for line in text.splitlines():
        bits=line.split(None,9)
        if len(bits)!=10: continue
        try: row={'pid':int(bits[0]),'ppid':int(bits[1]),'rss_kib':int(bits[2]),'cpu_percent':float(bits[3]),'started':' '.join(bits[4:9]),'executable':bits[9]}
        except ValueError: continue
        rows.append(row)
    return rows
start=time.monotonic(); first=processes()
root=next((r for r in first if r['pid']==a.pid),None)
if root is None: raise SystemExit('Target PID is absent')
initial_webkit={r['pid'] for r in first if 'WebKit' in r['executable']}
webkit_names={}
def named_helpers(rows):
    result=[]
    if not a.app_name: return result
    for row in rows:
        if 'WebKit' not in row['executable']: continue
        identity=(row['pid'],row['started'])
        if identity not in webkit_names:
            info=subprocess.run(['/usr/bin/lsappinfo','info',str(row['pid'])],capture_output=True,text=True,timeout=5)
            first_line=info.stdout.splitlines()[0] if info.stdout else ''
            names=[a.app_name+' '+suffix for suffix in ['Networking','Web Content','Graphics and Media']]
            match=next((name for name in names if first_line.startswith('"'+name+'" ASN:')),None)
            webkit_names[identity]=(match,first_line)
        name,line=webkit_names[identity]
        if name: result.append(dict(row,attribution='LaunchServices exact unique application name; not an explicit responsibility chain',launchservices=line))
    return result
a.output.parent.mkdir(parents=True,exist_ok=True)
with a.output.open('x') as out:
    while time.monotonic()-start < a.seconds:
        rows=processes(); current=next((r for r in rows if r['pid']==a.pid and r['started']==root['started']),None)
        family={a.pid}
        while True:
            expanded=family|{r['pid'] for r in rows if r['ppid'] in family}
            if expanded==family: break
            family=expanded
        descendants=[r for r in rows if r['pid'] in family] if current else []
        named=named_helpers(rows)
        marker=a.marker.read_text().strip() if a.marker and a.marker.exists() else 'unlabelled'
        sample={'schema':'oi.native-process-sample/v1','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsed_seconds':time.monotonic()-start,'marker':marker,'target_alive':current is not None,'attributable_processes':descendants,'rss_sum_kib_includes_shared_pages':sum(r['rss_kib'] for r in descendants),'unattributed_webkit':[dict(r,new_since_sampler=r['pid'] not in initial_webkit) for r in rows if 'WebKit' in r['executable'] and r['pid'] not in family],'native_heap_bytes':None,'gpu_bytes':None,'subscriptions':None}
        sample['application_named_webkit']=named
        sample['application_named_webkit_rss_kib_includes_shared_pages']=sum(r['rss_kib'] for r in named if r['pid'] not in family)
        out.write(json.dumps(sample)+'\n');out.flush()
        if current is None: break
        time.sleep(1)
print(json.dumps({'output':str(a.output),'target':root,'elapsed_seconds':time.monotonic()-start}))
