import React, { useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

function HumanAvatar({ url, isAnimating }) {
  const { scene, animations } = useGLTF(url);
  const mixerRef = useRef(null);

  useEffect(() => {
    if (!scene) return;

    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    scene.position.sub(center);

    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    scene.scale.multiplyScalar(2 / maxDim);

    if (animations && animations.length > 0) {
      const mixer = new THREE.AnimationMixer(scene);
      const action = mixer.clipAction(animations[0]);
      action.play();
      mixerRef.current = mixer;
    }
  }, [scene, animations]);

  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });

  if (!scene) return null;
  return <primitive object={scene} />;
}

export function Avatar3D({ isAnimating = false }) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [0, 0, 2.5], fov: 50 }}>
        <color attach="background" args={['#0f172a']} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 5, 5]} intensity={1.8} />
        <directionalLight position={[-5, 2, -5]} intensity={0.6} />
        <pointLight position={[0, 1, 3]} intensity={0.8} />

        <Suspense fallback={null}>
          <HumanAvatar url="/avatars3d/avatar.glb" isAnimating={isAnimating} />
        </Suspense>
      </Canvas>
    </div>
  );
}
