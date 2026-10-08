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
const DURATION = 1800;

export const HeroTrailer = () => {
  const frame = useCurrentFrame();
  const musicVolume = interpolate(frame, [0, 90, 1290, 1320, 1620, 1650, 1800], [0, 0.18, 0.18, 0.07, 0.07, 0.18, 0.18], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{backgroundColor: '#0a0b1a'}}>
    <Sequence name="01 · Meet Hero" from={0} durationInFrames={120}>
      <IntroScene />
    </Sequence>
    <Sequence name="02 · Choose your tour" from={120} durationInFrames={180}>
      <HomeScene />
    </Sequence>
    <Sequence name="03 · Name the Place" from={300} durationInFrames={240}>
      <MapScene />
    </Sequence>
    <Sequence name="04 · Find the Land" from={540} durationInFrames={150}>
      <FindScene />
    </Sequence>
    <Sequence name="05 · Lands Forgotten" from={690} durationInFrames={150}>
      <ForgottenScene />
    </Sequence>
    <Sequence name="06 · Meet Clio" from={840} durationInFrames={150}>
      <ClioScene />
    </Sequence>
    <Sequence name="07 · Make it yours" from={990} durationInFrames={180}>
      <CustomsScene />
    </Sequence>
    <Sequence name="08 · The Hero community" from={1170} durationInFrames={150}>
      <MontageScene />
    </Sequence>
    <Sequence name="09 · For the stewards" from={1320} durationInFrames={300}>
      <AdminScene />
    </Sequence>
    <Sequence name="10 · All new. All Hero." from={1620} durationInFrames={180}>
      <FinaleScene />
    </Sequence>

    {/* Scene voiceovers, aligned to the storyboard's scene start frames. */}
    <Sequence name="VO · Scene 01" from={0} durationInFrames={120}>
      <Audio src={staticFile('vo/01.mp3')} volume={0.9} />
    </Sequence>
    <Sequence name="VO · Scene 02" from={120} durationInFrames={180}>
      <Audio src={staticFile('vo/02.mp3')} volume={0.9} />
    </Sequence>
    <Sequence name="VO · Scene 03" from={300} durationInFrames={240}><Audio src={staticFile('vo/03.mp3')} volume={0.9} /></Sequence>
    <Sequence name="VO · Scene 04" from={540} durationInFrames={150}><Audio src={staticFile('vo/04.mp3')} volume={0.9} /></Sequence>
    <Sequence name="VO · Scene 05" from={690} durationInFrames={150}><Audio src={staticFile('vo/05.mp3')} volume={0.9} /></Sequence>
    <Sequence name="VO · Scene 06" from={840} durationInFrames={150}><Audio src={staticFile('vo/06.mp3')} volume={0.9} /></Sequence>
    <Sequence name="VO · Scene 07" from={990} durationInFrames={180}><Audio src={staticFile('vo/07.mp3')} volume={0.9} /></Sequence>
    <Sequence name="VO · Scene 08" from={1170} durationInFrames={150}><Audio src={staticFile('vo/08.mp3')} volume={0.9} /></Sequence>
    <Sequence name="VO · Scene 09" from={1320} durationInFrames={300}><Audio src={staticFile('vo/09.mp3')} volume={0.9} /></Sequence>
    <Sequence name="VO · Scene 10" from={1620} durationInFrames={180}><Audio src={staticFile('vo/10.mp3')} volume={0.9} /></Sequence>

    <Sequence name="Music · Upbeat bed" from={0} durationInFrames={DURATION}>
      <Audio src={staticFile('music/upbeat.mp3')} loop volume={musicVolume} />
    </Sequence>
  </AbsoluteFill>;
};

export const RemotionRoot = () => (
  <Composition id="HeroTrailer" component={HeroTrailer} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={DURATION} />
);
