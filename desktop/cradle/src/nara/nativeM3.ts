/** QL's whole native M3 generation, privately bound to the current encounter.
 * This transport declares no form, identity or activity arithmetic. */
import type {NativeDialogueRequest} from './dialogueTypes';
export interface M3Selections {
  clock_steps:number;address:number;pose:number;aperture:number;matrix_axis:number;rna:boolean;
}
export type M3Operation=
 |{operation:'select-form';address:number}|{operation:'change-line';line:number}
 |{operation:'apply-matrix';family:number}|{operation:'set-pose';pose:number}
 |{operation:'set-aperture';aperture:number}|{operation:'reciprocal-aperture'}
 |{operation:'advance-clock';steps:number}|{operation:'transcribe';rna:boolean}
 |{operation:'cast-creases';angles_deg10:[number,number,number];velocities_deg10:[number,number,number]};
export type M3Gesture=
 |{operation:'open';selections:M3Selections;activity_policy?:'historical-personal-frame-sprite-v1'}
 |{operation:'read'}
 |{operation:'select_activity_policy';expected_generation:number;expected_revision:string;activity_policy:'historical-personal-frame-sprite-v1'}
 |{operation:'apply';expected_generation:number;operations:M3Operation[]};
export type NativeM3Request=M3Gesture&{binding:NativeDialogueRequest};
export interface NativeM3State {
 schema:'ql.m3-state/v1';registry_revision:string;domain_revision:string;source_revision:string;
 identity:{event_ref:string;profile_generation:number};subject_ref:string;
 form:{address:number;pose:number;pose_ordinal:number;state_count:number;
  codon:{id:string;ref:string};hexagram:{id:string;ref:string};
  angles_deg10:number[];velocities_deg10:number[];pair_angles_deg10:number[];matrix_axis:number;
  hinge_geometry:{schema:'ql.m3-hinge-presentation/v1';embedding:'normalized-directed-unit-pair-hinge/v1';
   points:{id:string;nucleotide:number;xyz:[number,number,number]}[];
   segments:{from:string;to:string;pair_index:number;angle_deg10:number}[];shared_hinge:'Y';source:unknown;policy:unknown;standing:string};
  physical_form:Record<string,unknown>;[key:string]:unknown};
 clock:{steps:number;degree720:number;degree360:number;completed_double_covers:number;
  backbone:{id:string;ref:string};[key:string]:unknown};
 aperture:{index:number;total_lenses:number;division_deg10:number;reciprocal_index:number;fibonacci_phase60:number;[key:string]:unknown};
 transcription:{rna:boolean;sequence:string;source:unknown;[key:string]:unknown};
 tarot:{suit:string;rank:string;[key:string]:unknown};[key:string]:unknown;
}
export interface NativeM3Reading {
 schema:'oi.m3-reception-context/v1';status:'available'|'absent';
 nara_ref:string;person_ref:string;expression_ref:string;expression_revision:number;
 identity_source_ref:string;identity_revision:string;profile_ref:string;profile_revision:string;
 coordinate_ref:string;event_ref:string|null;revision:string|null;
 state:NativeM3State|null;
 receipts:{schema:'ql.m3-receipt/v1';status:string;before_generation:number;after_generation:number;[key:string]:unknown}[]|null;
 private:true;public_export:false;activity_admitted:boolean;
 activity_policy?:'historical-personal-frame-sprite-v1'|null;
 activity?:{policy:string;status:string;[key:string]:unknown}|null;
}
