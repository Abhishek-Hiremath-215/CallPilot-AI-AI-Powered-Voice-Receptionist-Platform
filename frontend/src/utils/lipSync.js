export function setupLipSync(audioElement, avatarScene) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaElementAudioSource(audioElement);
    
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    analyser.fftSize = 256;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function updateLipSync() {
      analyser.getByteFrequencyData(dataArray);

      // Get average frequency for mouth opening
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const mouthOpen = average / 256;

      avatarScene.traverse((child) => {
        if (child.morphTargetInfluences) {
          for (let i = 0; i < child.morphTargetInfluences.length; i++) {
            child.morphTargetInfluences[i] = mouthOpen;
          }
        }
      });

      if (!audioElement.paused) {
        requestAnimationFrame(updateLipSync);
      }
    }

    updateLipSync();
  } catch (error) {
    console.log('Lip-sync not available:', error);
  }
}
