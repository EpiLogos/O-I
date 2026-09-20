"""Receipt-admission unit tests. Not Mac/provider/audio observations."""
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('acceptance',Path(__file__).resolve().parents[1]/'walk'/'central-local-acceptance.py')
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
class Admission(unittest.TestCase):
 def setUp(self):
  self.challenge={'nonce':'fresh-unit-test-only','check':'microphone_audio','binaries':{'ctrl':'sha-a','oi':'sha-b'}}
  self.observation={**self.challenge,'observed':True,'test_only':False,'evidence_refs':['local:retained-proof']}
 def test_exact_attributed_report_is_admitted(self):self.assertEqual(a.observation_state(self.observation,self.challenge),'passed')
 def test_old_nonce_fails(self):self.observation['nonce']='old';self.assertEqual(a.observation_state(self.observation,self.challenge),'failed')
 def test_other_obligation_fails(self):self.observation['check']='real_provider_return_origin';self.assertEqual(a.observation_state(self.observation,self.challenge),'failed')
 def test_wrong_binary_basis_fails(self):self.observation['binaries']={'ctrl':'old','oi':'sha-b'};self.assertEqual(a.observation_state(self.observation,self.challenge),'failed')
 def test_unperformed_stays_pending(self):self.observation['observed']=False;self.assertEqual(a.observation_state(self.observation,self.challenge),'pending')
 def test_test_only_is_never_live_acceptance(self):self.observation['test_only']=True;self.assertEqual(a.observation_state(self.observation,self.challenge),'pending')
 def test_missing_support_stays_pending(self):self.observation['evidence_refs']=[];self.assertEqual(a.observation_state(self.observation,self.challenge),'pending')
 def test_malformed_report_fails(self):self.assertEqual(a.observation_state([],self.challenge),'failed')
if __name__=='__main__':unittest.main()
