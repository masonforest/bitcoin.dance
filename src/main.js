$(function(){
  var camera, scene, renderer, geometry, material, mesh;
  var text3d;

  var canvas = document.createElement('canvas');;

  var ctx = canvas.getContext("2d");
  ctx.font = "12px Arial";
  var text = "Test Test",
      textWidth = ctx.measureText(text).width;
  ctx.fillText(text, 30, 30);
  init();
  animate();

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 30, 1, 1, 1000 );;
    camera.position.z = 100
    scene.add(camera);
    geometry = new THREE.CylinderGeometry(13.5, 13.5, 20, 100, 100, true); // Cone

    var texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;

    THREE.ImageUtils.crossOrigin = '';
    material = new THREE.MeshBasicMaterial({
      map: texture,
      overdraw: true
    })

    // material = new THREE.MeshBasicMaterial({
    //   map: THREE.ImageUtils.loadTexture('http://i.imgur.com/3tU4Vig.jpg'),
    //   overdraw: true
    // })

    mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.y = -45.75;

    scene.add(mesh);
    renderer = new THREE.WebGLRenderer({alpha: true});
    renderer.setClearColor( 0x000000, 0 );
    renderer.setSize(360, 360);
    el = renderer.domElement;
    el.setAttribute("id", "overlay")
    document.body.appendChild(el);
    var f = document.getElementsByClassName("preview")[0];
    f.appendChild(el);
  }

  function animate() {
    requestAnimationFrame(animate);
    render();
  }



  function render()
  {
    mesh.rotation.y += 0.03;
    renderer.render( scene, camera );
  }
});
