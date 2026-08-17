from pathlib import Path

path = Path('cli/tests/suite_skillset.rs')
text = path.read_text()
text = text.replace('b134142532602a9570f2deb1060a1badb8432c6d', '7d6ebbd056e9eb30d2a2d1d477e7d6fb32e37010')
old = '''    let actuation = effective
        .expected_native_skills
        .iter()
        .find(|gap| gap.owner_product == "Actuation")
        .unwrap();
    assert_eq!(actuation.requiredness, Requiredness::IfProductInstalled);
    assert!(!effective
        .skills
        .iter()
        .any(|skill| skill.owner_product == "Actuation"));'''
new = '''    assert!(effective.expected_native_skills.is_empty());
    let actuation = effective
        .skills
        .iter()
        .find(|skill| skill.skill_ref == "actuation:operator")
        .expect("published Actuation native Skill remains visible even when unresolved");
    assert_eq!(actuation.requiredness, Requiredness::IfProductInstalled);
    assert_eq!(actuation.availability, SkillAvailability::Missing);
    assert!(effective
        .skills
        .iter()
        .filter(|skill| skill.owner_product == "Actuation")
        .all(|skill| skill.availability == SkillAvailability::Missing));'''
if old not in text:
    raise SystemExit('stale Actuation expectation fixture not found')
text = text.replace(old, new, 1)
path.write_text(text)
