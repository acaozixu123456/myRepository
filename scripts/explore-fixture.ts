import {freshProgress} from '../src/explore/state';
import {sampleRoad} from '../src/explore/geo';
import {writeFileSync} from 'node:fs';
const point=sampleRoad(37.2);
const pose=(offset:number)=>({x:point.x+point.tz*offset,z:point.z-point.tx*offset,yaw:Math.atan2(point.tz,-point.tx),pitch:0});
writeFileSync('/tmp/explore-fixture.json',JSON.stringify({fresh:freshProgress(),shop:{...freshProgress(),pose:pose(5.6)},door:{...freshProgress(),pose:pose(2.6)},normal:{x:point.tz,z:-point.tx},point}));
