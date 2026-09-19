import {ProductionAdapter} from '../src/production';
import {fieldStudies,blankScene,blankJourney,entity,pin,clone} from '../src/model';
import {toNativeConfig,nativeSnapshotToJourney,importDocuments,nativeChakras} from '../src/nativeBridge';
import {defaultCamera,project,unproject} from '../src/camera';
import {PointCloudField} from '../../src/engine/PointCloudField';
import {COMPOSITION_PRESETS} from '../../src/engine/compositionPresets';
import {makePin as makeNativePin} from '../../src/engine/fieldModel';
import {migrateConfig} from '../../src/engine/configMigration';
(window as any).NATIVE_TEST={ProductionAdapter,PointCloudField,fieldStudies,blankScene,blankJourney,entity,pin,clone,toNativeConfig,nativeSnapshotToJourney,importDocuments,nativeChakras,COMPOSITION_PRESETS,makeNativePin,migrateConfig,defaultCamera,project,unproject};
