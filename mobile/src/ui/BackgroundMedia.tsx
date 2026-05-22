// Fundal layered: poster (Image) + clip live (VideoView muted+loop) deasupra
// cand `videoUrl` exista. Poster-ul ramane mereu vizibil ca placeholder pana
// se incarca video-ul, deci niciun flash negru. `pointerEvents="none"` ca
// touch-urile sa treaca prin el la UI-ul de deasupra.
//
// Folosit ca background fullscreen pe home si ca background-frame pe profil.

import { Image, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

type Props = {
  imageUrl: string;
  videoUrl: string | null;
};

export function BackgroundMedia({ imageUrl, videoUrl }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri: imageUrl }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      {videoUrl && <BackgroundVideo uri={videoUrl} />}
    </View>
  );
}

function BackgroundVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}
