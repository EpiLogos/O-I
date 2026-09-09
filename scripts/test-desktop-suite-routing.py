#!/usr/bin/env python3
"""Read-only parity against real locally built owners; never substitutes fake CLIs."""
import json, os, subprocess, tempfile, unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
OI = Path(os.environ.get('OI_TEST_BIN', ROOT / 'cli/target/debug/oi'))
WORK = ROOT.parent
OWNERS = [
 ('central','OI_CENTRAL_CTRL_BIN',WORK/'Central/target/debug/ctrl'),
 ('actuation','OI_ACTUATION_BIN',WORK/'Actuation/bin/actuation'),
 ('aikit','OI_AIKIT_BIN',WORK/'ai-kit/target/debug/aikit'),
 ('factory','OI_FACTORY_BIN',WORK/'Software-Factory/target/debug/factory'),
 ('workcell','OI_WORKCELL_BIN',WORK/'Workcell/target/debug/workcell'),
 ('ql','OI_QL_BIN',WORK/'Quaternal-Logic/target/debug/ql'),
]
class Routing(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
  self.env=dict(os.environ, OI_HOME=self.tmp.name, AIKIT_HOME=str(Path(self.tmp.name)/'aikit'), OI_BIN=str(OI), OI_CENTRAL_ROOT=str(WORK.parent))
  for _,key,path in OWNERS:
   self.env[key]=os.environ.get(key,str(path))
   self.assertTrue(Path(self.env[key]).is_file(), f'Build actual owner first: {self.env[key]}')
  self.env['OI_AIKIT_SESSION_SPACE_BIN']=os.environ.get('OI_AIKIT_SESSION_SPACE_BIN',str(WORK/'ai-kit/target/debug/aikit-session-space'))
 def call(self,*args):
  return subprocess.run([str(a) for a in args],env=self.env,cwd=ROOT,capture_output=True,timeout=45)
 def test_all_six_native_help_preserved(self):
  for namespace,key,path in OWNERS:
   with self.subTest(namespace=namespace):
    direct=self.call(self.env[key],'--help'); routed=self.call(OI,namespace,'--help')
    self.assertEqual(direct.returncode,0,direct.stderr.decode())
    self.assertEqual((routed.returncode,routed.stdout,routed.stderr),(direct.returncode,direct.stdout,direct.stderr))
 def test_native_refusal_preserved(self):
  direct=self.call(self.env['OI_CENTRAL_CTRL_BIN'],'--json','action','run','no.such.action','{}')
  routed=self.call(OI,'central','--json','action','run','no.such.action','{}')
  self.assertNotEqual(direct.returncode,0)
  self.assertEqual((routed.returncode,routed.stdout,routed.stderr),(direct.returncode,direct.stdout,direct.stderr))
 def test_desktop_files_reader_uses_actual_central(self):
  result=self.call(OI,'desktop','files','list','Work/O-I')
  self.assertEqual(result.returncode,0,result.stderr.decode())
  reading=json.loads(result.stdout)
  self.assertIn('README.md',[e['name'] for e in reading['entries']])
  entry=next(e for e in reading['entries'] if e['name']=='README.md')
  result=self.call(OI,'desktop','files','read',json.dumps(entry['location']))
  self.assertEqual(result.returncode,0,result.stderr.decode())
  self.assertEqual(json.loads(result.stdout)['content'],(ROOT/'README.md').read_text())
 def test_session_space_companion_and_application_parity(self):
  native=self.call(self.env['OI_AIKIT_SESSION_SPACE_BIN'],'-C',self.tmp.name,'discover','--project','project:o-i')
  route=self.call(OI,'aikit-session-space','-C',self.tmp.name,'discover','--project','project:o-i')
  desktop=self.call(OI,'desktop','session-spaces',self.tmp.name,'project:o-i')
  self.assertEqual(native.returncode,0,native.stderr.decode())
  self.assertEqual(route.stdout,native.stdout)
  self.assertEqual(desktop.returncode,0,desktop.stderr.decode())
  self.assertEqual(json.loads(desktop.stdout),json.loads(native.stdout))
 def test_knowledge_history_application_parity(self):
  native=self.call(self.env['OI_AIKIT_BIN'],'--json','-C',self.tmp.name,'knowledge','history')
  desktop=self.call(OI,'desktop','knowledge',self.tmp.name,'{"action":"history"}')
  self.assertEqual(native.returncode,0,native.stderr.decode())
  self.assertEqual(desktop.returncode,0,desktop.stderr.decode())
  self.assertEqual(json.loads(desktop.stdout),json.loads(native.stdout)['data'])
if __name__=='__main__': unittest.main()
