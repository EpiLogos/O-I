from pathlib import Path
p=Path('desktop/cradle/tests/agent-native-local.py');s=p.read_text()
needle='def check_prior(value: Any, basis: dict) -> dict:'
assert s.count(needle)==1
s=s.replace(needle,'''def validate_delivery(event: Any, prepared: dict) -> dict:
    if not isinstance(event, dict) or event.get('kind') != 'direct-agent-context-submitted':
        raise Refused('No new native parent context delivery was observed.')
    expected = {'agent_ref':prepared['agent_ref'], 'profile_ref':prepared['profile_ref'],
                'acceptance_ref':prepared['acceptance_ref'], 'skill_sources':prepared['skill_sources'],
                'delivery':'native-parent-session-prompt-payload', 'authority_granted':False,
                'model_consumption_observed':False, 'brokered_child_activation_observed':False}
    if any(event.get(k) != v for k,v in expected.items()):
        raise Refused('Native context delivery differs from the accepted Agent or effective Skills.')
    digest=event.get('payload_digest','')
    if not isinstance(digest,str) or not digest.startswith('blake3:') or len(digest)!=71 or any(c not in '0123456789abcdef' for c in digest[7:]):
        raise Refused('Native context delivery has no bounded payload digest.')
    return {k:event[k] for k in [*expected,'payload_digest']}

'''+needle)
needle="        save('live-operation-submitted-outcome-unknown')"
assert s.count(needle)==1
s=s.replace(needle,'''        def journal(after: int) -> tuple[int,list[dict]]:
            events: list[dict]=[]
            for _ in range(64):
                page=encounter('read',agent_session=session,after=after,limit=128)
                if page.get('agent_session')!=session or not isinstance(page.get('events'),list):
                    raise Refused('Native journal returned another or unreadable session.')
                cursor=page.get('next_cursor')
                if not isinstance(cursor,int) or cursor<after:
                    raise Refused('Native journal cursor did not preserve its reading basis.')
                events.extend(page['events'])
                if page.get('more') is False:return cursor,events
                if cursor<=after:raise Refused('Native journal pagination made no progress.')
                after=cursor
            raise Refused('Native journal exceeds this bounded acceptance walk; choose an isolated session.')
        baseline,_=journal(0)
'''+needle)
needle="        save('same-native-reopen-and-source-return-observed' if args.phase=='resume' else 'live-source-return-observed');return 0"
assert s.count(needle)==1
s=s.replace(needle,"""        _,new_events=journal(baseline)
        deliveries=[row.get('event') for row in new_events if isinstance(row.get('event'),dict) and row['event'].get('kind')=='direct-agent-context-submitted']
        if not deliveries:raise Refused('The source returned without a fresh accepted-Agent context-delivery receipt.')
        result['context_delivery']=validate_delivery(deliveries[-1],prepared)
"""+needle)
p.write_text(s);compile(s,str(p),'exec')
p=Path('desktop/cradle/tests/agent-native-local.test.py');s=p.read_text()
needle="if __name__=='__main__':unittest.main()";assert s.count(needle)==1
s=s.replace(needle,''' def test_context_delivery_matches_actual_prepared_skill_digests(self):
  prepared={'agent_ref':'a','profile_ref':'p','acceptance_ref':'accepted','skill_sources':[{'reference':'skill/native/reader','content_digest':'sha256:actual'}]}
  event={'kind':'direct-agent-context-submitted',**prepared,'delivery':'native-parent-session-prompt-payload','authority_granted':False,'model_consumption_observed':False,'brokered_child_activation_observed':False,'payload_digest':'blake3:'+'a'*64}
  self.assertEqual(p.validate_delivery(event,prepared)['skill_sources'],prepared['skill_sources'])
  for patch in [{'skill_sources':[]},{'profile_ref':'other'},{'payload_digest':'made-up'},{'authority_granted':True},{'model_consumption_observed':True},{'brokered_child_activation_observed':True}]:
   with self.subTest(patch=patch),self.assertRaises(p.Refused):p.validate_delivery({**event,**patch},prepared)
'''+needle)
p.write_text(s);compile(s,str(p),'exec')
