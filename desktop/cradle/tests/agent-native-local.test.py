import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
spec=importlib.util.spec_from_file_location('packet',Path(__file__).with_name('agent-native-local.py'))
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
class Packet(unittest.TestCase):
 def review(self):
  profile={'ref':'p','agent_ref':'a','revision':'r'}
  return {'schema':'central.agent-profile-review/v1','profile':profile,'scope_ref':'control:root','content_digest':'sha256:d','execution_authority_granted':False,'accepted':True,'acceptance':{'schema':'central.agent-profile-acceptance/v1','acceptance_ref':'accept','profile_ref':'p','agent_ref':'a','profile_revision':'r','scope_ref':'control:root','content_digest':'sha256:d'}}
 def test_exact_native_acceptance(self):
  self.assertEqual(p.validate_review(self.review(),'control:root','p',True)['profile']['agent_ref'],'a')
 def test_stale_forged_scope_authority_and_receipt(self):
  for change in [{'accepted':False},{'scope_ref':'foreign'},{'execution_authority_granted':True},{'acceptance':{'acceptance_ref':'forged'}}]:
   with self.subTest(change=change),self.assertRaises(p.Refused):p.validate_review({**self.review(),**change},'control:root','p',True)
 def test_wrong_source(self):
  with self.assertRaises(p.Refused):p.validate_review(self.review(),'control:root','another',True)
 def test_no_implicit_trim(self):
  for text in ['', ' leading', 'trailing\n','nul\0byte']:
   with self.assertRaises(p.Refused):p.exact_text(text,100,'Purpose')
 def test_redacts_native_refusal_details(self):
  with self.assertRaises(p.Refused) as e:p.decode(json.dumps({'ok':False,'error':{'code':'denied','message':'SECRET NOT FOR RECEIPT'}}))
  self.assertNotIn('SECRET',str(e.exception))
 def test_prior_must_match_candidates_and_scope(self):
  self.assertEqual(p.check_prior({'schema':p.SCHEMA,'basis':{'x':1}}, {'x':1})['basis'], {'x':1})
  with self.assertRaises(p.Refused):p.check_prior({'schema':p.SCHEMA,'basis':{'x':1}}, {'x':2})
 def test_atomic_private_checkpoint(self):
  with tempfile.TemporaryDirectory() as tmp:
   path=Path(tmp)/'receipt';p.checkpoint(path,{'phase':'before-effect'});p.checkpoint(path,{'phase':'returned'})
   self.assertEqual(json.loads(path.read_text()),{'phase':'returned'});self.assertEqual(path.stat().st_mode&0o777,0o600)
 def test_mutation_requires_explicit_execution(self):
  with tempfile.TemporaryDirectory() as tmp:
   path=Path(tmp)/'receipt'
   run=subprocess.run([sys.executable,p.__file__,'--cwd',tmp,'--receipt',str(path),'--phase','propose'],capture_output=True)
   self.assertEqual(run.returncode,2);self.assertFalse(path.exists())
 def test_accept_requires_separate_basis(self):
  with tempfile.TemporaryDirectory() as tmp:
   run=subprocess.run([sys.executable,p.__file__,'--cwd',tmp,'--receipt',str(Path(tmp)/'r'),'--phase','accept','--execute'],capture_output=True)
   self.assertEqual(run.returncode,2)
 def test_context_delivery_matches_actual_prepared_skill_digests(self):
  prepared={'agent_ref':'a','profile_ref':'p','acceptance_ref':'accepted','skill_sources':[{'reference':'skill/native/reader','content_digest':'sha256:actual'}]}
  event={'kind':'direct-agent-context-submitted',**prepared,'delivery':'native-parent-session-prompt-payload','authority_granted':False,'model_consumption_observed':False,'brokered_child_activation_observed':False,'payload_digest':'blake3:'+'a'*64}
  self.assertEqual(p.validate_delivery(event,prepared)['skill_sources'],prepared['skill_sources'])
  for patch in [{'skill_sources':[]},{'profile_ref':'other'},{'payload_digest':'made-up'},{'authority_granted':True},{'model_consumption_observed':True},{'brokered_child_activation_observed':True}]:
   with self.subTest(patch=patch),self.assertRaises(p.Refused):p.validate_delivery({**event,**patch},prepared)
if __name__=='__main__':unittest.main()
