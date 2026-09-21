"""Local packet validation only; none of these tests are a live-provider claim."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('native_live',Path(__file__).with_name('agent-native-live.py'))
live=importlib.util.module_from_spec(spec)
spec.loader.exec_module(live)

class PacketTests(unittest.TestCase):
    def test_false_owner_envelope_cannot_be_a_success(self):
        with self.assertRaisesRegex(live.CheckFailed, 'scope_denied'):
            live.decode_reply('{"ok":false,"error":{"code":"scope_denied","message":"PRIVATE SECRET MUST NOT ESCAPE"}}')
    def test_error_omits_private_owner_message(self):
        try:
            live.decode_reply('{"ok":false,"error":{"message":"PRIVATE SECRET MUST NOT ESCAPE"}}')
        except live.CheckFailed as error:
            self.assertNotIn('PRIVATE',str(error))
    def test_native_envelope_is_unwrapped(self):
        self.assertEqual(live.decode_reply('{"ok":true,"data":{"revision":7}}'),{'revision':7})
    def test_plain_native_discovery_array_is_kept(self):
        self.assertEqual(live.decode_reply('[{"id":"real"}]'),[{'id':'real'}])
    def test_echoed_prompt_old_output_and_tool_text_are_not_new_assistant_work(self):
        view={'blocks':[{'id':1,'kind':'assistant','text':'old'}, {'id':3,'kind':'user','text':'prompt'}, {'id':4,'kind':'tool','text':'tool'}, {'id':5,'kind':'assistant','text':'new'}]}
        self.assertEqual(live.new_assistant_text(view,2),'new')
    def test_probe_requires_a_fresh_nonsecret_nonce_shape(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'probe.txt'
            path.write_text('ordinary private content')
            with self.assertRaises(live.CheckFailed): live.read_probe(path)
            token='OI_AGENT_PROBE_'+'1a'*16
            path.write_text(token+'\n')
            self.assertEqual(live.read_probe(path),token)
    def test_redirected_probe_is_not_accepted(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'source';path.write_text('OI_AGENT_PROBE_'+'1a'*16)
            link=Path(root)/'redirect';link.symlink_to(path)
            with self.assertRaises(live.CheckFailed):live.read_probe(link)

if __name__=='__main__': unittest.main()
