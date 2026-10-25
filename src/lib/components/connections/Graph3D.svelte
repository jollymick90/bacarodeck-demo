<script lang="ts">
  import { onMount } from 'svelte';
  import type { GraphNode, GraphEdge } from '$lib/connections/types';
  let {
    nodes,
    edges,
    selected,
    onselect,
    onfailure
  }: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    selected: string;
    onselect: (id: string) => void;
    onfailure: () => void;
  } = $props();
  let host: HTMLDivElement;
  let rebuild: (() => void) | undefined;
  $effect(() => {
    void nodes;
    void edges;
    void selected;
    rebuild?.();
  });
  onMount(() => {
    let disposed = false;
    let cleanup = () => {};
    void (async () => {
      try {
        const THREE = await import('three');
        const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
        if (disposed) return;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0xedf3fa);
        host.appendChild(renderer.domElement);
        renderer.domElement.setAttribute(
          'aria-label',
          'Mappa 3D: trascina per ruotare, usa due dita o la rotella per zoomare. Seleziona un nodo con un clic.'
        );
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        camera.position.set(0, 0, 22);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = false;
        controls.autoRotate = false;
        controls.minDistance = 5;
        controls.maxDistance = 45;
        let objects: import('three').Mesh[] = [];
        const resources: { dispose: () => void }[] = [];
        const render = () => renderer.render(scene, camera);
        const clear = () => {
          scene.clear();
          resources.splice(0).forEach((r) => r.dispose());
          objects = [];
        };
        rebuild = () => {
          clear();
          const positions = new Map<string, import('three').Vector3>();
          nodes.forEach((node, index) => {
            const i = index + 1;
            const y = 1 - (i / (nodes.length + 1)) * 2;
            const radius = Math.sqrt(1 - y * y);
            const angle = i * Math.PI * (3 - Math.sqrt(5));
            const point =
              node.id === selected
                ? new THREE.Vector3()
                : new THREE.Vector3(
                    Math.cos(angle) * radius * 7,
                    y * 6,
                    Math.sin(angle) * radius * 5
                  );
            positions.set(node.id, point);
            const geometry = new THREE.SphereGeometry(node.id === selected ? 0.48 : 0.27, 20, 14);
            const material = new THREE.MeshBasicMaterial({
              color:
                node.kind === 'speaker' ? 0x182f50 : node.kind === 'topic' ? 0x087e8b : 0x9e4276
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(point);
            mesh.userData.id = node.id;
            scene.add(mesh);
            objects.push(mesh);
            resources.push(geometry, material);
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#182f50';
              ctx.font = '26px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(
                node.label.length > 34 ? node.label.slice(0, 32) + '…' : node.label,
                256,
                42
              );
              const texture = new THREE.CanvasTexture(canvas);
              const labelMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false });
              const sprite = new THREE.Sprite(labelMaterial);
              sprite.position.copy(point).add(new THREE.Vector3(0, -0.65, 0));
              sprite.scale.set(4, 0.5, 1);
              scene.add(sprite);
              resources.push(texture, labelMaterial);
            }
          });
          edges.forEach((edge) => {
            const a = positions.get(edge.source),
              b = positions.get(edge.target);
            if (!a || !b) return;
            const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
            const material = new THREE.LineBasicMaterial({
              color: edge.origin === 'automatic' ? 0x8a9eb8 : 0x087e8b
            });
            scene.add(new THREE.Line(geometry, material));
            resources.push(geometry, material);
          });
          render();
        };
        const resize = () => {
          const width = host.clientWidth,
            height = host.clientHeight;
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          render();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        const raycaster = new THREE.Raycaster();
        let down = { x: 0, y: 0 };
        const pointerDown = (event: PointerEvent) => {
          down = { x: event.clientX, y: event.clientY };
        };
        const pointerUp = (event: PointerEvent) => {
          if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
          const rect = renderer.domElement.getBoundingClientRect();
          raycaster.setFromCamera(
            new THREE.Vector2(
              ((event.clientX - rect.left) / rect.width) * 2 - 1,
              (-(event.clientY - rect.top) / rect.height) * 2 + 1
            ),
            camera
          );
          const hit = raycaster.intersectObjects(objects)[0];
          if (hit) onselect(String(hit.object.userData.id));
        };
        const lost = (event: Event) => {
          event.preventDefault();
          onfailure();
        };
        renderer.domElement.addEventListener('pointerdown', pointerDown);
        renderer.domElement.addEventListener('pointerup', pointerUp);
        renderer.domElement.addEventListener('webglcontextlost', lost);
        controls.addEventListener('change', render);
        cleanup = () => {
          rebuild = undefined;
          observer.disconnect();
          controls.dispose();
          clear();
          renderer.domElement.removeEventListener('pointerdown', pointerDown);
          renderer.domElement.removeEventListener('pointerup', pointerUp);
          renderer.domElement.removeEventListener('webglcontextlost', lost);
          renderer.dispose();
          renderer.domElement.remove();
        };
        rebuild();
        resize();
      } catch {
        if (!disposed) onfailure();
      }
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  });
</script>

<div class="graph-canvas" bind:this={host}></div>

<style>
  .graph-canvas {
    height: min(52vh, 520px);
    min-height: 300px;
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
  }
  .graph-canvas :global(canvas) {
    display: block;
    touch-action: none;
  }
</style>
