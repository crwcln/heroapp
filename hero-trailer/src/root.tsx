import React from 'react';
import {Audio} from '@remotion/media';
import {AbsoluteFill, Composition, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {
  AdminScene, ClioScene, CustomsScene, FinaleScene, FindScene, ForgottenScene,
  HomeScene, IntroScene, MapScene, MontageScene,
} from './scenes';

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
// Frame lengths match the supplied voice clips at 30 fps, rounded up so none are trimmed.
const DURATION = 1862;
const VO_WINDOWS: Array<[number, number]> = [
  [0, 107], [107, 305], [305, 548], [548, 699], [699, 875],
  [875, 1026], [1026, 1246], [1246, 1418], [1418, 1720], [1720, 1862],
];

const getMusicVolume = (frame: number) => {
  const adminBlend = interpolate(frame, [1408, 1418, 1720, 1730], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const base = interpolate(adminBlend, [0, 1], [0.3, 0.17]);
  let duck = 1;
  for (const [start, end] of VO_WINDOWS) {
    if (frame >= start && frame <= end) {
      duck = 0.45;
      break;
    }
    if (frame >= start - 5 && frame < start) {
      duck = interpolate(frame, [start - 5, start], [1, 0.45], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    }
    if (frame > end && frame <= end + 5) {
      duck = interpolate(frame, [end, end + 5], [0.45, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    }
  }
  const fadeIn = interpolate(frame, [0, 18], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const fadeOut = interpolate(frame, [DURATION - 18, DURATION], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return base * duck * fadeIn * fadeOut;
};

export const HeroTrailer = () => {
  const frame = useCurrentFrame();
  const musicVolume = getMusicVolume(frame);
  return <AbsoluteFill style={{backgroundColor: '#0a0b1a'}}>
    <Sequence name="01 · Meet Hero" from={0} durationInFrames={107}>
      <IntroScene />
    </Sequence>
    <Sequence name="02 · Choose your tour" from={107} durationInFrames={198}>
      <HomeScene />
    </Sequence>
    <Sequence name="03 · Name the Place" from={305} durationInFrames={243}>
      <MapScene />
    </Sequence>
    <Sequence name="04 · Find the Land" from={548} durationInFrames={151}>
      <FindScene />
    </Sequence>
    <Sequence name="05 · Lands Forgotten" from={699} durationInFrames={176}>
      <ForgottenScene />
    </Sequence>
    <Sequence name="06 · Meet Clio" from={875} durationInFrames={151}>
      <ClioScene />
    </Sequence>
    <Sequence name="07 · Make it yours" from={1026} durationInFrames={220}>
      <CustomsScene />
    </Sequence>
    <Sequence name="08 · The Hero community" from={1246} durationInFrames={172}>
      <MontageScene />
    </Sequence>
    <Sequence name="09 · For the stewards" from={1418} durationInFrames={302}>
      <AdminScene />
    </Sequence>
    <Sequence name="10 · All new. All Hero." from={1720} durationInFrames={142}>
      <FinaleScene />
    </Sequence>

    {/* Scene voiceovers, aligned to the storyboard's scene start frames. */}
    <Sequence name="VO · Scene 01" from={0} durationInFrames={107}>
      <Audio src={staticFile('vo/01.mp3')} volume={0.9} />
    </Sequence>
    <Sequence name="VO · Scene 02" from={107} durationInFrames={198}>
      <Audio src={staticFile('vo/02.mp3')} volume={0.9} />
    </Sequence>
    <Sequence name="VO · Scene 03" from={305} durationInFrames={243}><Audio src={staticFile('vo/03.mp3')} volume={0.9} /></Sequence>
    <Sequence name="VO · Scene 04" from={548} durationInFrames={151}><Audio src={staticFile('vo/04.mp3')} volume={0.9} /></Sequence>
    <Sequence name="VO · Scene 05" from={699} durationInFrames={176}><Audio src={staticFile('vo/05.mp3')} volume={0.9} /></Sequence>
    <Sequence name="VO · Scene 06" from={875} durationInFrames={151}><Audio src={staticFile('vo/06.mp3')} volume={0.9} /></Sequence>
    <Sequence name="VO · Scene 07" from={1026} durationInFrames={220}><Audio src={staticFile('vo/07.mp3')} volume={0.9} /></Sequence>
    <Sequence name="VO · Scene 08" from={1246} durationInFrames={172}><Audio src={staticFile('vo/08.mp3')} volume={0.9} /></Sequence>
    <Sequence name="VO · Scene 09" from={1418} durationInFrames={302}><Audio src={staticFile('vo/09.mp3')} volume={0.9} /></Sequence>
    <Sequence name="VO · Scene 10" from={1720} durationInFrames={142}><Audio src={staticFile('vo/10.mp3')} volume={0.9} /></Sequence>

    <Sequence name="Music · Upbeat bed" from={0} durationInFrames={DURATION}>
      <Audio src={staticFile('music/upbeat.mp3')} loop volume={musicVolume} />
    </Sequence>
  </AbsoluteFill>;
};

export const RemotionRoot = () => (
  <Composition id="HeroTrailer" component={HeroTrailer} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={DURATION} />
);
