import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, BarChart3, BriefcaseBusiness, Check,
  ChevronLeft, ChevronRight, CircleUserRound, Clock3, LayoutDashboard, LogOut,
  Menu, Pause, Phone, Play, Plus, Search, Send, Settings2, Sparkles, Target, Trash2, TrendingUp,
  Users, X
} from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { api } from './api.js';

gsap.registerPlugin(ScrollTrigger);

const approach = [
  { number: '01', title: 'PLAN', text: 'Understand requirements and identify opportunities.' },
  { number: '02', title: 'ADVISE', text: 'Provide relevant professional guidance and solutions.' },
  { number: '03', title: 'GROW', text: 'Support progress and long-term development.' },
];

function ConsultationModal({ open, onClose, services, phone }) {
  const [sent, setSent] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [whatsAppHref, setWhatsAppHref] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const enquiry = {
      name: form.get('name'),
      email: form.get('email'),
      phone: form.get('phone'),
      company: form.get('company'),
      service: form.get('service'),
      message: form.get('message'),
      preferredContact: form.get('preferredContact')
    };
    try {
      const result = await api('/public/enquiries', {
        method: 'POST',
        body: {
          ...enquiry,
          consent: form.get('consent') === 'on'
        }
      });
      setLeadId(result.id);
      const whatsAppMessage = [
        'New L8R Consultancy enquiry',
        `CRM reference: ${result.id}`,
        `Name: ${enquiry.name}`,
        `Phone: ${enquiry.phone}`,
        `Email: ${enquiry.email}`,
        `Company: ${enquiry.company || 'Not provided'}`,
        `Service: ${enquiry.service || 'Not specified'}`,
        `Preferred contact: ${enquiry.preferredContact}`,
        `Requirement: ${enquiry.message}`
      ].join('\n');
      setWhatsAppHref(`https://wa.me/${String(phone || '+91 7567490201').replace(/\D/g, '')}?text=${encodeURIComponent(whatsAppMessage)}`);
      setSent(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }
  function close() {
    setSent(false);
    setLeadId('');
    setWhatsAppHref('');
    setError('');
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Request a consultation">
      <div className="modal">
        <button className="modal-close" onClick={close} aria-label="Close"><X size={18} /></button>
        {sent ? (
          <div className="success-state">
            <div className="success-mark"><Check /></div>
            <p className="eyebrow">ENQUIRY RECEIVED</p>
            <h2>Thank you for reaching out.</h2>
            <p>Your enquiry has been saved to the CRM as <b>{leadId}</b>. To also send it to WhatsApp, open the message below and tap Send.</p>
            <div className="success-actions">
              <a className="button success-whatsapp" href={whatsAppHref} target="_blank" rel="noreferrer">SEND ENQUIRY ON WHATSAPP <ArrowRight size={16} /></a>
              <button className="button button-dark" onClick={close}>Back to website</button>
            </div>
          </div>
        ) : (
          <>
            <p className="eyebrow">START A CONVERSATION</p>
            <h2>Request a consultation</h2>
            <form onSubmit={submit}>
              <div className="form-grid">
                <label>Full name<input required name="name" placeholder="Your name" /></label>
                <label>Phone number<input required name="phone" placeholder="+91" /></label>
                <label>Email address<input required type="email" name="email" placeholder="you@company.com" /></label>
                <label>Company name<input name="company" placeholder="Optional" /></label>
                <label className="full">Interested service
                  <select name="service"><option value="">Not sure yet</option>{services.map((service) => <option key={service.id} value={service.title}>{service.title}</option>)}</select>
                </label>
                <label className="full">Preferred contact method
                  <select name="preferredContact"><option>Email</option><option>Phone</option><option>WhatsApp</option></select>
                </label>
                <label className="full">Requirement description<textarea required name="message" placeholder="Tell us about your requirement" /></label>
                <label className="consent full"><input required type="checkbox" name="consent" /> <span>I consent to being contacted regarding this enquiry.</span></label>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="button button-dark form-submit" type="submit" disabled={busy}>{busy ? 'SENDING…' : 'SEND ENQUIRY'} <ArrowRight size={16} /></button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Header({ onConsult }) {
  const [scrolled, setScrolled] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.scrollY > window.innerHeight * 1.8);
    window.addEventListener('scroll', handler);
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, []);
  const links = [['Services', 'services'], ['Projects', 'work'], ['About', 'about'], ['Contact', 'contact']];
  return (
    <header className={scrolled ? 'header scrolled' : 'header'}>
      <a className="brand" href="#top" aria-label="L8R Consultancy home">
        <img src="/logo.png" alt="L8R Consultancy" />
      </a>
      <nav className={menu ? 'nav open' : 'nav'} aria-label="Main navigation">
        {links.map(([label, id]) => <a key={id} href={`#${id}`} onClick={() => setMenu(false)}>{label}</a>)}
      </nav>
      <button className="header-cta" onClick={onConsult}>LET'S TALK <ArrowUpRight size={15} /></button>
      <button className="menu-button" onClick={() => setMenu(!menu)} aria-label="Toggle menu">{menu ? <X /> : <Menu />}</button>
    </header>
  );
}

function Carousel({ items, type = 'services' }) {
  const [paused, setPaused] = useState(false);
  const [activeCard, setActiveCard] = useState(0);
  const trackRef = useRef(null);
  const drag = useRef(null);
  const track = [...items, ...items];
  useEffect(() => {
    const element = trackRef.current;
    if (!element || paused || items.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let frame;
    let previous = performance.now();
    const step = (now) => {
      const elapsed = Math.min(now - previous, 40);
      previous = now;
      const midpoint = element.scrollWidth / 2;
      if (midpoint > 0) {
        element.scrollLeft += elapsed * 0.025;
        if (element.scrollLeft >= midpoint) element.scrollLeft -= midpoint;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [paused, items.length]);
  function dragStart(event) {
    if (event.pointerType !== 'mouse') return;
    drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function dragMove(event) {
    if (drag.current) event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
  }
  function move(direction) {
    const el = trackRef.current;
    if (el) {
      el.scrollBy({ left: direction * 360, behavior: 'smooth' });
      setPaused(true);
      window.setTimeout(() => setPaused(false), 3500);
    }
  }
  function onScroll(event) {
    const element = event.currentTarget;
    const first = element.firstElementChild;
    if (first && items.length) setActiveCard(Math.floor(element.scrollLeft / (first.getBoundingClientRect().width + 18)) % items.length);
  }
  return (
    <div className="carousel-shell" onMouseEnter={() => setPaused(true)} onMouseLeave={() => { setPaused(false); drag.current = null; }} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
      <div className={`carousel-track ${paused ? 'paused' : ''}`} data-carousel={type} ref={trackRef} tabIndex={0} aria-label={`${type} carousel`} onKeyDown={(event) => { if (event.key === 'ArrowRight') move(1); if (event.key === 'ArrowLeft') move(-1); }} onScroll={onScroll} onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        {track.map((item, index) => {
          const Icon = [BriefcaseBusiness, TrendingUp, BarChart3, Target][index % 4];
          return type === 'services' ? (
            <article className="service-card" key={`${item.id || item.title}-${index}`}>
              <div className="card-top"><Icon size={28} /><span>{String(index % Math.max(items.length, 1) + 1).padStart(2, '0')}</span></div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <a className="card-link" href={`/services/${encodeURIComponent(item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))}`}>Explore service <ArrowUpRight size={15} /></a>
            </article>
          ) : type === 'projects' ? (
            <article className="project-carousel-card" key={`${item.id || item.title}-${index}`}>
              <a href={`/projects/${encodeURIComponent(item.slug)}`} className="project-carousel-image">{item.cover_image ? <img src={item.cover_image} alt={item.image_alt || item.title} loading="lazy" /> : <div className="project-image-fallback"><span>PROJECT / {String(index % Math.max(items.length, 1) + 1).padStart(2, '0')}</span><BriefcaseBusiness size={30} /></div>}</a>
              <div className="project-carousel-copy"><p>{item.category || 'PROJECT'}</p><h3>{item.title}</h3><span>{item.overview}</span><a className="card-link" href={`/projects/${encodeURIComponent(item.slug)}`}>VIEW PROJECT <ArrowRight size={14} /></a></div>
            </article>
          ) : type === 'testimonials' ? (
            <article className="testimonial-carousel-card" key={`${item.id || item.client_name}-${index}`}><span>“</span><blockquote>{item.quote}</blockquote><p>{item.client_name}{item.company ? ` · ${item.company}` : ''}</p></article>
          ) : type === 'industries' ? (
            <article className="industry-carousel-card" key={`${item}-${index}`}><span>0{index % Math.max(items.length, 1) + 1}</span><h3>{item}</h3><ArrowUpRight /></article>
          ) : (
            <article className="insight-card" key={`${item.id || item.title}-${index}`}>
              <div className={`insight-image insight-${index % 3}`}><span>INSIGHT / {(item.category || 'PERSPECTIVE').toUpperCase()}</span></div>
              <div className="insight-copy"><p>{new Date(item.created_at || Date.now()).toLocaleDateString()}</p><h3>{item.title}</h3><p className="insight-excerpt">{item.excerpt}</p><a className="card-link" href={`/insights/${encodeURIComponent(item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))}`}>Read article <ArrowRight size={15} /></a></div>
            </article>
          );
        })}
      </div>
      <div className="carousel-controls">
        <button onClick={() => move(-1)} aria-label="Previous"><ChevronLeft /></button>
        <button onClick={() => move(1)} aria-label="Next"><ChevronRight /></button>
        <button onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Play carousel' : 'Pause carousel'}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
      </div>
      {items.length > 1 && <div className="carousel-dots">{items.map((item, index) => <button key={item.id || item.title || item} className={index === activeCard ? 'active' : ''} aria-label={`Go to item ${index + 1}`} onClick={() => { const el = trackRef.current; const card = el?.children[index]; if (card) { el.scrollTo({ left: card.offsetLeft, behavior: 'smooth' }); setPaused(true); window.setTimeout(() => setPaused(false), 3500); } }} />)}</div>}
    </div>
  );
}

function ThreeHeroScene({ reducedMotion, scrollProgressRef }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let frameId = 0;
    let renderer;
    let scene;
    let environmentTarget;
    let resizeHandler;
    let pointerAimHandler;
    let floor;
    let mirror;

    async function initialize() {
      const [THREE, { RoomEnvironment }, { Reflector }] = await Promise.all([
        import('three'),
        import('three/addons/environments/RoomEnvironment.js'),
        import('three/addons/objects/Reflector.js')
      ]);
      if (disposed) return;

      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      const getLayout = (viewportWidth) => viewportWidth < 768 ? 'mobile' : viewportWidth < 1024 ? 'tablet' : 'desktop';
      const layout = getLayout(width);
      let currentLayout = layout;
      const pixelRatio = layout === 'mobile'
        ? Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2)
        : Math.min(window.devicePixelRatio || 1, 1.5);
      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x050505, 11, 26);

      const camera = new THREE.PerspectiveCamera(layout === 'mobile' ? 40 : layout === 'tablet' ? 40 : 38, width / height, 0.1, 80);
      camera.position.set(0, layout === 'mobile' ? 0.25 : 0.15, layout === 'mobile' ? 9.6 : layout === 'tablet' ? 11.5 : 11);
      camera.lookAt(0, layout === 'mobile' ? 0.15 : 0, 0);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.setClearColor(0x050505, 0);
      mount.appendChild(renderer.domElement);

      const room = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      environmentTarget = pmrem.fromScene(room, 0.04);
      scene.environment = environmentTarget.texture;
      pmrem.dispose();

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const keyLight = new THREE.SpotLight(0xffffff, 36, 24, Math.PI / 5, 0.72, 1.2);
      keyLight.position.set(2, 7, 7);
      scene.add(keyLight);
      const rimLight = new THREE.PointLight(0xc9c9c9, 18, 14);
      rimLight.position.set(-4, 1, 3);
      scene.add(rimLight);
      const edgeLight = new THREE.PointLight(0xffffff, 14, 12);
      edgeLight.position.set(5, 2, -3);
      scene.add(edgeLight);
      const mobileAccentLight = new THREE.PointLight(0xffffff, layout === 'mobile' ? 7 : 0, 10);
      mobileAccentLight.position.set(-2, 3, 6);
      scene.add(mobileAccentLight);

      const installation = new THREE.Group();
      installation.position.set(layout === 'mobile' ? 0 : layout === 'tablet' ? 1.4 : 2, layout === 'mobile' ? 0.7 : 0, 0);
      installation.scale.setScalar(layout === 'mobile' ? 1.3 : layout === 'tablet' ? 0.9 : 1);
      scene.add(installation);

      const panelMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x090909,
        metalness: 0.95,
        roughness: 0.2,
        clearcoat: 1,
        clearcoatRoughness: 0.12
      });
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.65, 0.2), panelMaterial);
      installation.add(panel);
      const frame = new THREE.LineSegments(
        new THREE.EdgesGeometry(panel.geometry),
        new THREE.LineBasicMaterial({ color: 0xd4d4d4, transparent: true, opacity: 0.72 })
      );
      installation.add(frame);

      const logoTexture = await new THREE.TextureLoader().loadAsync('/metallic-logo.png');
      if (disposed) {
        logoTexture.dispose();
        return;
      }
      logoTexture.colorSpace = THREE.SRGBColorSpace;
      logoTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const logoMaterial = new THREE.MeshBasicMaterial({ map: logoTexture, transparent: true });
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(2.92, 2.92 / (logoTexture.image.width / logoTexture.image.height)),
        logoMaterial
      );
      face.position.z = 0.106;
      installation.add(face);

      const ringMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xc5c5c5,
        metalness: 1,
        roughness: 0.16,
        clearcoat: 1
      });
      const rings = new THREE.Group();
      rings.add(new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.025, 12, 180), ringMaterial));
      const ringTwo = new THREE.Mesh(new THREE.TorusGeometry(2.72, 0.018, 12, 180), ringMaterial);
      ringTwo.rotation.set(0.82, 0.45, 0.2);
      rings.add(ringTwo);
      const ringThree = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.015, 12, 180), ringMaterial);
      ringThree.rotation.set(1.16, -0.62, -0.35);
      rings.add(ringThree);
      rings.scale.setScalar(layout === 'mobile' ? 0.82 : 1);
      installation.add(rings);

      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(1.8, 2, 0.14, 96),
        new THREE.MeshPhysicalMaterial({ color: 0x070707, metalness: 0.75, roughness: 0.32, clearcoat: 0.6 })
      );
      platform.position.y = -1.85;
      platform.visible = layout !== 'mobile';
      installation.add(platform);
      const platformEdge = new THREE.Mesh(
        new THREE.TorusGeometry(1.91, 0.025, 10, 96),
        ringMaterial
      );
      platformEdge.rotation.x = Math.PI / 2;
      platformEdge.position.y = -1.77;
      platformEdge.visible = layout !== 'mobile';
      installation.add(platformEdge);

      floor = new THREE.Mesh(
        new THREE.PlaneGeometry(160, 160),
        new THREE.MeshStandardMaterial({ color: 0x080808, metalness: 0.8, roughness: 0.32 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -2.12;
      floor.visible = layout !== 'mobile';
      scene.add(floor);
      mirror = new Reflector(new THREE.PlaneGeometry(32, 32), {
        clipBias: 0.003,
        textureWidth: Math.min(1024, Math.floor(width * pixelRatio)),
        textureHeight: Math.min(1024, Math.floor(height * pixelRatio)),
        color: 0x333333
      });
      mirror.rotation.x = -Math.PI / 2;
      mirror.position.y = -2.1;
      mirror.visible = layout !== 'mobile';
      scene.add(mirror);

      function resize() {
        const nextWidth = Math.max(mount.clientWidth, 1);
        const nextHeight = Math.max(mount.clientHeight, 1);
        const layout = getLayout(nextWidth);
        currentLayout = layout;
        camera.aspect = nextWidth / nextHeight;
        camera.fov = layout === 'mobile' ? 40 : layout === 'tablet' ? 40 : 38;
        camera.position.set(0, layout === 'mobile' ? 0.25 : 0.15, layout === 'mobile' ? 9.6 : layout === 'tablet' ? 11.5 : 11);
        camera.lookAt(0, layout === 'mobile' ? 0.15 : 0, 0);
        installation.position.set(layout === 'mobile' ? 0 : layout === 'tablet' ? 1.4 : 2, layout === 'mobile' ? 0.7 : 0, 0);
        installation.scale.setScalar(layout === 'mobile' ? 1.3 : layout === 'tablet' ? 0.9 : 1);
        rings.scale.setScalar(layout === 'mobile' ? 0.82 : 1);
        mobileAccentLight.intensity = layout === 'mobile' ? 7 : 0;
        platform.visible = layout !== 'mobile';
        platformEdge.visible = layout !== 'mobile';
        floor.visible = layout !== 'mobile';
        mirror.visible = layout !== 'mobile';
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(layout === 'mobile'
          ? Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2)
          : Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setSize(nextWidth, nextHeight);
      }
      resizeHandler = resize;
      window.addEventListener('resize', resizeHandler);

      const pointerAim = new THREE.Vector2();
      let pointerCurrentX = 0;
      let pointerCurrentY = 0;
      pointerAimHandler = (event) => {
        const bounds = renderer.domElement.getBoundingClientRect();
        pointerAim.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
        pointerAim.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      };
      renderer.domElement.addEventListener('pointermove', pointerAimHandler);
      const render = () => {
        const time = reducedMotion ? 0 : performance.now() * 0.001;
        const scrollProgress = scrollProgressRef?.current?.value || 0;
        installation.rotation.y = Math.sin(time * 0.28) * 0.06;
        installation.rotation.x = Math.sin(time * 0.22) * 0.025;
        pointerCurrentX += (pointerAim.x - pointerCurrentX) * 0.035;
        pointerCurrentY += (pointerAim.y - pointerCurrentY) * 0.035;
        camera.position.x = scrollProgress * 0.04 + pointerCurrentX * 0.04;
        camera.lookAt(0, (currentLayout === 'mobile' ? 0.15 : 0) + scrollProgress * 0.025, 0);
        keyLight.position.x = 2 + scrollProgress * 0.15 + pointerCurrentX * 0.12;
        rimLight.position.y = 1 + pointerCurrentY * 0.08;
        rings.rotation.y = (reducedMotion ? 0 : time * 0.12) + scrollProgress * 0.18 + pointerCurrentX * 0.025;
        rings.rotation.z = reducedMotion ? 0 : Math.sin(time * 0.16) * 0.08;
        rings.rotation.x = pointerCurrentY * 0.018;
        renderer.render(scene, camera);
        if (!reducedMotion) frameId = window.requestAnimationFrame(render);
      };
      render();
    }

    initialize().catch((error) => {
      if (!disposed) console.error('Could not initialize the 3D hero scene:', error);
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      if (renderer && pointerAimHandler) renderer.domElement.removeEventListener('pointermove', pointerAimHandler);
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
      if (environmentTarget) environmentTarget.dispose();
      if (scene) {
        scene.traverse((object) => {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.filter(Boolean).forEach((material) => {
            material.map?.dispose();
            material.dispose();
          });
        });
      }
    };
  }, [reducedMotion]);

  return (
    <div className="hero-three-scene" ref={mountRef} role="img" aria-label="L8R logo framed by rotating metallic rings" />
  );
}
function CinematicHero({ onConsult, companies }) {
  const sectionRef = useRef(null);
  const introRef = useRef(null);
  const logoRef = useRef(null);
  const heroRef = useRef(null);
  const copyRef = useRef(null);
  const scrollProgressRef = useRef({ value: 0 });
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const intro = introRef.current;
    const logo = logoRef.current;
    const hero = heroRef.current;
    const copy = copyRef.current;
    if (!section || !intro || !logo || !hero || !copy) return undefined;
    if (reducedMotion) return undefined;

    const context = gsap.context(() => {
      gsap.set(hero, { autoAlpha: 0, clipPath: 'circle(0% at 68% 50%)' });
      gsap.set(copy, { autoAlpha: 0 });
      gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=120%',
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            scrollProgressRef.current.value = self.progress;
          }
        }
      })
        .to(logo, {
          scale: () => Math.max(
            window.innerWidth / (logo.offsetWidth || 300),
            window.innerHeight / (logo.offsetHeight || 200)
          ) * 3,
          duration: 1.1,
          ease: 'none'
        })
        .to(intro, { autoAlpha: 0, duration: 0.2, ease: 'none' })
        .to(hero, { autoAlpha: 1, clipPath: 'circle(150% at 68% 50%)', duration: 0.9, ease: 'none' }, '-=0.1')
        .fromTo(copy, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: 'none' }, '-=0.25');
    }, section);

    return () => context.revert();
  }, [reducedMotion]);

  return (
    <section className={`cinematic-hero ${reducedMotion ? 'reduced-motion' : ''}`} id="top" ref={sectionRef}>
      <div className="cinematic-logo-intro" ref={introRef}>
        <img ref={logoRef} src="/metallic-logo.png" alt="L8R Consultancy" />
        <p>SCROLL TO REVEAL</p>
      </div>
      <div className="cinematic-environment" ref={heroRef}>
        <div className="cinematic-atmosphere" aria-hidden="true" />
        <div className="cinematic-copy" ref={copyRef}>
          <p className="cinematic-eyebrow">STRATEGIZE <i>•</i> BUILD <i>•</i> GROW</p>
          <h1>YOUR GROWTH.<br /><em>OUR STRATEGY.</em></h1>
          <p className="cinematic-lede">L8R Consultancy helps ambitious businesses scale with cutting-edge solutions, modern technology and strategic expertise.</p>
          <div className="cinematic-actions">
            <a className="button button-light" href="#services">EXPLORE SERVICES <ArrowRight size={16} /></a>
            <a className="text-button" href="#work">VIEW PROJECTS <span><ArrowUpRight size={16} /></span></a>
          </div>
          <div className="hero-inline-marquees">
            <AutoScrollStrip
              label="SERVICES"
              items={offeredServices}
              className="services-marquee"
              renderItem={(service, index) => <><small>0{index + 1}</small><span>{service}</span><i aria-hidden="true">✳</i></>}
            />
            <AutoScrollStrip
              label="COMPANIES WE'VE WORKED WITH"
              items={companies || []}
              direction="right"
              className="companies-marquee"
              emptyText="Verified client companies added in the CRM will appear here."
              renderItem={(company) => {
                const identity = company.logo_url
                  ? <img src={company.logo_url} alt={company.name} loading="lazy" decoding="async" />
                  : <span>{company.name}</span>;
                return company.website_url
                  ? <a href={company.website_url} target="_blank" rel="noreferrer">{identity}</a>
                  : identity;
              }}
            />
          </div>
        </div>
        {!isMobile && <ThreeHeroScene reducedMotion={reducedMotion} scrollProgressRef={scrollProgressRef} />}
        <p className="hero-trust">TRUSTED BY FORWARD-THINKING BUSINESSES</p>
        <div className="cinematic-index"><span className="scroll-mark">↓</span><small>SCROLL TO EXPLORE</small><span className="index-line" /><small>01 / 04</small></div>
      </div>
    </section>
  );
}
const offeredServices = [
  'Digital Marketing',
  'Social Media Marketing',
  'Web Development',
  'Hosting and Maintenance',
  'Business Growth'
];

function AutoScrollStrip({ label, items, direction = 'left', className = '', emptyText = '', renderItem }) {
  if (!items.length) {
    if (!emptyText) return null;
    return <section className={`marquee-section ${className}`} aria-label={label}><p className="marquee-label">{label}</p><p className="marquee-empty">{emptyText}</p></section>;
  }
  const content = (copy) => items.map((item, index) => (
    <span className="marquee-item" key={`${copy}-${item.id || item}-${index}`}>{renderItem(item, index)}</span>
  ));
  return (
    <section className={`marquee-section ${className}`} aria-label={label}>
      <p className="marquee-label">{label}</p>
      <div className="marquee-window">
        <div className={`marquee-track marquee-${direction}`}>
          <div className="marquee-group">{content('primary')}</div>
          <div className="marquee-group" aria-hidden="true" inert>{content('duplicate')}</div>
        </div>
      </div>
    </section>
  );
}

function PublicSite({ onConsult }) {
  const [site, setSite] = useState({ settings: {}, services: [], articles: [], testimonials: [], industries: [], caseStudies: [], projects: [], companies: [] });
  const [legalPage, setLegalPage] = useState('');
  useEffect(() => {
    api('/public/site').then(setSite).catch((error) => console.error('Could not load published website content:', error.message));
  }, []);
  const settings = site.settings;

  return (
    <>
      <Header onConsult={onConsult} />
      <main>
        <CinematicHero onConsult={onConsult} companies={site.companies} />

        <section className="intro section" id="about">
          <div className="section-label"><span>02</span><p>ABOUT L8R</p></div>
          <div className="intro-grid">
            <h2>{settings.about_heading || 'More than consultancy. A partner in your progress.'}</h2>
            <div className="intro-copy">
              <p>{settings.about_body || 'Company introduction coming soon.'}</p>
              <p>We help turn complexity into direction—combining thoughtful analysis, focused advice and disciplined execution.</p>
              <a className="inline-link" href="#approach">DISCOVER OUR APPROACH <ArrowRight size={15} /></a>
            </div>
          </div>
        </section>

        <section className="work section" id="work">
          <div className="section-heading"><div><p className="eyebrow">SELECTED PROJECTS</p><h2>OUR WORK.<br /><em>OUR IMPACT.</em></h2></div><p>Only approved projects and verified outcomes are featured here.</p></div>
          {site.projects.length ? <Carousel items={site.projects} type="projects" /> : <p className="empty-public">Approved project work will appear here when published by L8R.</p>}
        </section>

        <section className="services section" id="services">
          <div className="section-heading">
            <div><p className="eyebrow">WHAT WE DO</p><h2>Solutions that move<br />you <em>forward.</em></h2></div>
            <p>Focused capabilities designed around your ambition, challenge and next stage of growth.</p>
          </div>
          {site.services.length ? <Carousel items={site.services} type="services" /> : <p className="empty-public">Approved service information will be published here soon.</p>}
        </section>

        <section className="principles section">
          <div className="principles-art">
            <div className="arch"><div /><div /><div /></div>
            <div className="principles-seal"><Sparkles size={18} /><span>PLAN<br />ADVISE<br />GROW</span></div>
          </div>
          <div className="principles-copy">
            <p className="eyebrow">WHY L8R CONSULTANCY</p>
            <h2>The right direction makes all the difference.</h2>
            <div className="principle-list">
              <article><span>01</span><div><h3>Clarity before action</h3><p>We focus on understanding the real challenge before shaping a solution.</p></div></article>
              <article><span>02</span><div><h3>Insight with relevance</h3><p>Practical thinking that connects context, opportunity and execution.</p></div></article>
              <article><span>03</span><div><h3>Progress with purpose</h3><p>Every recommendation is grounded in a clear path toward meaningful outcomes.</p></div></article>
            </div>
          </div>
        </section>

        <section className="approach section" id="approach">
          <p className="eyebrow">OUR APPROACH</p>
          <h2>Plan. Advise. <em>Grow.</em></h2>
          <div className="timeline">
            {approach.map((step) => (
              <article key={step.number}>
                <div className="timeline-number">{step.number}</div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="industries section" id="industries">
          <div className="industries-heading"><p className="eyebrow">INDUSTRIES</p><h2>Perspective across<br /><em>the business landscape.</em></h2></div>
          {site.industries.length ? <Carousel items={site.industries} type="industries" /> : null}
          {!site.industries.length && <p className="empty-public">Industry coverage will be updated when confirmed.</p>}
        </section>

        <section className="insights section" id="insights">
          <div className="section-heading">
            <div><p className="eyebrow">L8R INSIGHTS</p><h2>Ideas for better<br /><em>decisions.</em></h2></div>
            <span className="inline-link">PUBLISHED ARTICLES</span>
          </div>
          {site.articles.length ? <Carousel items={site.articles} type="insights" /> : <p className="empty-public">New insights will appear here when published.</p>}
        </section>

        {site.testimonials.length > 0 && <section className="testimonials section">
          <p className="eyebrow">CLIENT PERSPECTIVES</p><h2>Trust, built through<br /><em>the work.</em></h2>
          <Carousel items={site.testimonials} type="testimonials" />
        </section>}

        <section className="careers section" id="careers">
          <div><p className="eyebrow">CAREERS AT L8R</p><h2>Bring your perspective.<br /><em>Build what’s next.</em></h2></div>
          <div><p>We welcome conversations with thoughtful people interested in working with L8R Consultancy. Contact us to enquire about future opportunities.</p><a className="inline-link" href={`mailto:${settings.email || 'l8rconsultancy@gmail.com'}?subject=Career%20enquiry`}>SEND A CAREER ENQUIRY <ArrowRight size={15} /></a></div>
        </section>

        <section className="cta" id="contact">
          <div className="cta-orb" />
          <p className="eyebrow">THE NEXT STEP</p>
          <h2>LET'S BUILD<br /><em>WHAT'S NEXT.</em></h2>
          <p>Have a requirement, an idea or a business challenge?<br />Let's start a conversation.</p>
          <div>
            <button className="button button-gold" onClick={onConsult}>REQUEST A CONSULTATION <ArrowRight size={16} /></button>
            <a className="text-button light" href={`tel:${(settings.phone || '+917567490201').replaceAll(' ', '')}`}>CONTACT OUR TEAM <span><Phone size={15} /></span></a>
          </div>
        </section>
      </main>
      <footer>
        <div className="footer-main">
          <div className="footer-brand"><img src="/logo.png" alt="L8R Consultancy" /><p>Strategic guidance for<br />meaningful progress.</p></div>
          <div><h4>EXPLORE</h4><a href="#about">About us</a><a href="#services">Services</a><a href="#industries">Industries</a><a href="#work">Case studies</a><a href="#insights">Insights</a><a href="#careers">Careers</a></div>
          <div><h4>CONNECT</h4><a href={`mailto:${settings.email || 'l8rconsultancy@gmail.com'}`}>{settings.email || 'l8rconsultancy@gmail.com'}</a><a href={`tel:${(settings.phone || '+917567490201').replaceAll(' ', '')}`}>{settings.phone || '+91 7567490201'}</a><a href={`https://wa.me/${(settings.phone || '+917567490201').replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a></div>
          <button className="footer-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>BACK TO TOP <ArrowUpRight size={14} /></button>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} L8R CONSULTANCY</span><div><button onClick={() => setLegalPage('privacy')}>Privacy policy</button><button onClick={() => setLegalPage('terms')}>Terms & conditions</button></div></div>
      </footer>
      <a className="whatsapp" href={`https://wa.me/${(settings.phone || '+917567490201').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"><Send size={19} /></a>
      {legalPage && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={legalPage === 'privacy' ? 'Privacy policy' : 'Terms and conditions'}><article className="article-modal">
        <button className="modal-close" onClick={() => setLegalPage('')} aria-label="Close"><X size={18} /></button><p className="eyebrow">L8R CONSULTANCY</p><h2>{legalPage === 'privacy' ? 'Privacy policy' : 'Terms & conditions'}</h2><div className="article-body">{settings[legalPage === 'privacy' ? 'privacy_text' : 'terms_text']}</div>
      </article></div>}
    </>
  );
}

function CRM() {
  const [user, setUser] = useState(undefined);
  const [view, setView] = useState('Dashboard');
  const [data, setData] = useState([]);
  const [overview, setOverview] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [team, setTeam] = useState([]);
  const [settings, setSettings] = useState({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [notesLead, setNotesLead] = useState(null);
  const [notes, setNotes] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const nav = [
    { title: 'Dashboard', icon: LayoutDashboard },
    { title: 'All Leads', icon: Users },
    { title: 'New Enquiries', icon: Sparkles },
    { title: 'Follow-ups', icon: Clock3 },
    { title: 'Clients', icon: BriefcaseBusiness },
    { title: 'Appointments', icon: Clock3 },
    { title: 'Services', icon: Target },
    { title: 'Companies', icon: BriefcaseBusiness },
    { title: 'Projects', icon: BriefcaseBusiness },
    { title: 'Case Studies', icon: BriefcaseBusiness },
    { title: 'Insights', icon: BarChart3 },
    { title: 'Testimonials', icon: Users },
    { title: 'Reports & Analytics', icon: TrendingUp },
    { title: 'SEO', icon: Search },
    { title: 'Team Management', icon: CircleUserRound },
    { title: 'Website Content', icon: Settings2 },
    { title: 'Settings', icon: Settings2 }
  ];

  async function load(viewName = view) {
    setError('');
    try {
      if (viewName === 'Dashboard' || viewName === 'Reports & Analytics') {
        const [stats, leads] = await Promise.all([api('/crm/overview'), api('/crm/leads')]);
        setOverview(stats);
        setData(viewName === 'Dashboard' ? stats.recent : leads);
        if (viewName === 'Reports & Analytics' && user?.role !== 'STAFF') {
          setAuditLogs(await api('/crm/audit'));
        }
      } else if (['All Leads', 'New Enquiries', 'Follow-ups', 'Clients'].includes(viewName)) {
        const params = new URLSearchParams();
        if (viewName === 'New Enquiries') params.set('status', 'NEW ENQUIRY');
        if (viewName === 'Follow-ups') params.set('followUps', 'true');
        if (viewName === 'Clients') params.set('clients', 'true');
        if (query.trim()) params.set('q', query.trim());
        if (statusFilter && viewName === 'All Leads') params.set('status', statusFilter);
        setData(await api(`/crm/leads?${params}`));
      } else if (viewName === 'Team Management') {
        setData(await api('/crm/team'));
      } else if (viewName === 'SEO') {
        const [servicesList, projects] = await Promise.all([api('/crm/services'), api('/crm/projects')]);
        setData([
          ...servicesList.map((item) => ({ ...item, _type: 'Service', publication_status: item.published ? 'PUBLISHED' : 'DRAFT' })),
          ...projects.map((item) => ({ ...item, _type: 'Project' }))
        ]);
      } else if (viewName === 'Settings') {
        setSettings(await api('/crm/settings'));
      } else if (viewName === 'Website Content') {
          const [servicesList, studies, articles, testimonials] = await Promise.all([
            api('/crm/services'), api('/crm/case_studies'), api('/crm/articles'), api('/crm/testimonials')
        ]);
          setData([...servicesList.map((item) => ({ ...item, _type: 'Service' })), ...studies.map((item) => ({ ...item, _type: 'Case study' })), ...articles.map((item) => ({ ...item, _type: 'Insight' })), ...testimonials.map((item) => ({ ...item, _type: 'Testimonial' }))]);
      } else {
        const resource = viewName === 'Appointments' ? 'appointments' : viewName.toLowerCase();
        setData(await api(`/crm/${resource}`));
      }
      if (user?.role !== 'STAFF') {
        try { setTeam(await api('/crm/team')); } catch { setTeam([]); }
      }
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    api('/auth/me').then((current) => setUser(current.authenticated === false ? null : current)).catch(() => setUser(null));
  }, []);
  useEffect(() => { if (user) load(view); }, [user, view, query, statusFilter]);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try { setUser(await api('/auth/login', { method: 'POST', body: { email: form.get('email'), password: form.get('password') } })); }
    catch (loginError) { setError(loginError.message); }
    finally { setBusy(false); }
  }

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); setUser(null); setView('Dashboard'); }
    catch (logoutError) { setError(logoutError.message); }
  }

  const resourceForView = { 'All Leads': 'leads', 'New Enquiries': 'leads', 'Follow-ups': 'leads', Clients: 'leads', Appointments: 'appointments', Services: 'services', Companies: 'companies', Projects: 'projects', 'Case Studies': 'case_studies', Insights: 'articles', Testimonials: 'testimonials' }[view];
  const fields = {
    leads: [
      ['full_name', 'Full name', 'text', true], ['email', 'Email', 'email', true], ['phone', 'Phone', 'text', true],
      ['company', 'Company', 'text'], ['service', 'Service', 'text'], ['source', 'Lead source', 'text'],
      ['description', 'Requirement / notes', 'textarea'], ['status', 'Pipeline status', 'select', true, ['NEW ENQUIRY','CONTACTED','QUALIFIED','CONSULTATION SCHEDULED','PROPOSAL SENT','CONVERTED','LOST','NURTURE']],
      ['follow_up_at', 'Follow-up date', 'date'], ['assigned_to', 'Assign to', 'team']
    ],
    appointments: [['title','Appointment title','text',true],['client_name','Client name','text',true],['email','Email','email'],['phone','Phone','text'],['starts_at','Date and time','datetime-local',true],['status','Status','select',true,['SCHEDULED','COMPLETED','CANCELLED']],['notes','Notes','textarea'],['lead_id','Linked lead ID','text']],
    services: [
      ['title','Service name','text',true],['slug','URL slug','text'],['description','Service introduction','textarea',true],
      ['who_for','Who this service is for','textarea'],['problems','Problems addressed','textarea'],['process','Our process','textarea'],
      ['faqs','FAQs as JSON: [{"question":"...","answer":"..."}]','textarea'],['seo_title','SEO title (max 70 characters)','text'],
      ['meta_description','SEO description (max 170 characters)','textarea'],['focus_keyword','Focus keyword','text'],['canonical_url','Canonical URL (optional)','url'],
      ['published','Publish on website','checkbox'],['sort_order','Display order','number']
    ],
    companies: [
      ['name','Company name','text',true],['logo_url','Logo URL (HTTPS)','url'],['website_url','Website URL (HTTPS)','url'],
      ['sort_order','Display order','number'],['published','Show in client strip','checkbox']
    ],
    projects: [
      ['title','Project title','text',true],['slug','URL slug','text'],['category','Project category','text'],['client_name','Client name (optional)','text'],
      ['overview','Project overview','textarea',true],['challenge','Challenge','textarea'],['solution','Strategy and solution','textarea'],['results','Verified results','textarea'],
      ['start_date','Start date','date'],['completion_date','Completion date','date'],['cover_image','Current cover image URL','hidden'],['cover','Upload cover image (JPG, PNG, WebP)','file'],
      ['image_alt','Cover image alt text','text'],['gallery_json','Current gallery URLs','hidden'],['gallery','Upload gallery images','files'],
      ['publication_status','Publication status','select',true,['DRAFT','PUBLISHED','ARCHIVED']],['featured','Feature on homepage','checkbox'],
      ['seo_title','SEO title (max 70 characters)','text'],['meta_description','SEO description (max 170 characters)','textarea'],['focus_keyword','Focus keyword','text'],['canonical_url','Canonical URL (optional)','url']
    ],
    articles: [['title','Article title','text',true],['category','Category','text'],['excerpt','Excerpt','textarea'],['body','Article body','textarea'],['published','Publish on website','checkbox']],
    testimonials: [['client_name','Client name','text',true],['company','Company','text'],['quote','Verified testimonial text','textarea',true],['published','Publish on website','checkbox']],
    case_studies: [['title','Project title','text',true],['industry','Industry','text'],['overview','Overview','textarea'],['challenge','Challenge','textarea'],['solution','Solution','textarea'],['results','Verified results','textarea'],['published','Publish on website','checkbox']],
    team: [['name','Full name','text',true],['email','Email','email',true],['role','Role','select',true,['ADMIN','STAFF']],['password','Temporary password (12+ characters)','password',true]],
    teamEdit: [['name','Full name','text',true],['email','Email','email',true],['role','Role','select',true,['ADMIN','STAFF']],['password','Reset password (optional, 12+ characters)','password']]
  };
  const columns = {
    leads: [['id','Lead ID'],['full_name','Contact'],['email','Email'],['service','Service'],['status','Status'],['follow_up_at','Follow-up']],
    appointments: [['title','Appointment'],['client_name','Contact'],['starts_at','Date'],['status','Status']],
    services: [['title','Service'],['description','Description'],['published','Published']],
    companies: [['name','Company'],['website_url','Website'],['published','Published'],['sort_order','Order']],
    projects: [['title','Project'],['category','Category'],['publication_status','Publication'],['featured','Featured'],['updated_at','Updated']],
    articles: [['title','Article'],['category','Category'],['published','Published']],
    testimonials: [['client_name','Client'],['company','Company'],['quote','Testimonial'],['published','Published']],
    case_studies: [['title','Project'],['industry','Industry'],['overview','Overview'],['results','Verified results'],['published','Published']],
    team: [['name','Team member'],['email','Email'],['role','Role'],['active','Active']]
  };

  function openForm(resource, record = null) {
    if (resource === 'website') {
      setNotice('Website sections are updated in Settings. Create services, insights and testimonials in their own sections.');
      return;
    }
    const formResource = resource === 'team' && record ? 'teamEdit' : resource;
    const initial = record ? { ...record } : {};
    if (resource === 'leads' && !record) initial.status = 'NEW ENQUIRY';
    if (resource === 'appointments' && !record) initial.status = 'SCHEDULED';
    if (resource === 'services' && !record) initial.sort_order = 0;
    if (resource === 'companies' && !record) { initial.sort_order = 0; initial.published = false; }
    if (resource === 'projects' && !record) { initial.publication_status = 'DRAFT'; initial.featured = false; initial.gallery_json = '[]'; }
    setModal({ resource: formResource, record, initial });
  }

  async function saveRecord(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const formData = new FormData(event.currentTarget);
    const values = {};
    for (const [key, value] of formData.entries()) values[key] = value;
    const resource = modal.resource;
    for (const [key, label, type] of fields[resource]) {
      if (type === 'checkbox') values[key] = formData.has(key);
      if (type === 'number') values[key] = Number(values[key] || 0);
    }
    try {
      const path = resource === 'team' || resource === 'teamEdit' ? '/crm/team' : `/crm/${resource}`;
      const url = modal.record ? `${path}/${encodeURIComponent(modal.record.id)}` : path;
      let payload = values;
      if (resource === 'projects') {
        for (const [key, label, type] of fields[resource]) {
          if (type === 'checkbox') formData.set(key, formData.has(key) ? '1' : '0');
        }
        payload = formData;
      }
      const result = await api(url, { method: modal.record ? 'PATCH' : 'POST', body: payload });
      setModal(null);
      setNotice(resource === 'projects' && result.publication_status === 'PUBLISHED'
        ? `Project published: /projects/${result.slug}`
        : modal.record ? 'Changes saved.' : `${resource === 'leads' ? `Lead created: ${result.id}` : resource === 'companies' ? 'Company added.' : 'Record created.'}`);
      await load(view);
    } catch (saveError) { setError(saveError.message); }
    finally { setBusy(false); }
  }

  async function removeRecord(resource, record) {
    if (!window.confirm(`Delete "${record.title || record.name || record.full_name || record.client_name || record.id}"? This cannot be undone.`)) return;
    try {
      await api(`/crm/${resource}/${encodeURIComponent(record.id)}`, { method: 'DELETE' });
      setNotice('Record deleted.');
      await load(view);
    } catch (deleteError) { setError(deleteError.message); }
  }

  async function showNotes(lead) {
    setNotesLead(lead);
    setNotes([]);
    try { setNotes(await api(`/crm/leads/${encodeURIComponent(lead.id)}/notes`)); }
    catch (notesError) { setError(notesError.message); }
  }

  async function addNote(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/crm/leads/${encodeURIComponent(notesLead.id)}/notes`, { method: 'POST', body: { note: form.get('note') } });
      setNotes(await api(`/crm/leads/${encodeURIComponent(notesLead.id)}/notes`));
      event.currentTarget.reset();
    } catch (noteError) { setError(noteError.message); }
  }

  async function updateSetting(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    values.industries = JSON.stringify(values.industries.split('\n').map((item) => item.trim()).filter(Boolean));
    try {
      setSettings(await api('/crm/settings', { method: 'PATCH', body: values }));
      setNotice('Website settings saved.');
    } catch (saveError) { setError(saveError.message); }
  }

  async function changePassword(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/crm/password', { method: 'POST', body: Object.fromEntries(form.entries()) });
      setUser(null);
      setNotice('Password changed. Sign in with your new password.');
    } catch (passwordError) { setError(passwordError.message); }
  }

  async function toggleTeam(member) {
    try {
      await api(`/crm/team/${encodeURIComponent(member.id)}`, { method: 'PATCH', body: { active: !member.active } });
      await load(view);
    } catch (teamError) { setError(teamError.message); }
  }

  async function changeProjectStatus(project, publication_status) {
    try {
      await api(`/crm/projects/${encodeURIComponent(project.id)}`, { method: 'PATCH', body: { publication_status } });
      setNotice(publication_status === 'PUBLISHED' ? `Published /projects/${project.slug}` : `Project moved to ${publication_status.toLowerCase()}.`);
      await load(view);
    } catch (statusError) { setError(statusError.message); }
  }

  async function exportLeads() {
    try {
      const response = await fetch('/api/crm/leads/export.csv', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Could not export leads.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = 'l8r-leads.csv'; link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) { setError(exportError.message); }
  }

  if (user === undefined) return <div className="crm-loading">Opening secure workspace…</div>;
  if (!user) return (
    <div className="crm-login">
      <form onSubmit={login}>
        <img src="/logo.png" alt="L8R Consultancy" />
        <p>SECURE CLIENT RELATIONSHIP MANAGEMENT</p>
        <h1>Welcome back.</h1>
        <label>Email address<input name="email" type="email" autoComplete="username" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        {error && <div className="crm-error" role="alert">{error}</div>}
        <button className="crm-primary" disabled={busy}>{busy ? 'SIGNING IN…' : 'SIGN IN SECURELY'}</button>
        <small>Access is provisioned by your L8R administrator. No public registration.</small>
      </form>
    </div>
  );

  const title = view === 'Dashboard' ? `Good morning, ${user.name.split(' ')[0]}.` : view;
  const resource = resourceForView;
  const canEdit = user.role !== 'STAFF' || resource === 'leads';
  const viewColumns = view === 'Team Management' ? columns.team : columns[resource];
  const items = view === 'Team Management' ? data : data;
  const visibleNav = nav.filter((item) => user.role !== 'STAFF' || !['Team Management','Services','Companies','Projects','Case Studies','Insights','Testimonials','Website Content','Settings','SEO'].includes(item.title));

  return (
    <div className="crm">
      <aside className="crm-sidebar">
        <a href="#top"><img src="/logo.png" alt="L8R Consultancy" /></a>
        <nav>
          {visibleNav.map(({ title: item, icon: Icon }) => <button className={view === item ? 'active' : ''} key={item} onClick={() => { setView(item); setNotice(''); }}><Icon size={16} />{item}</button>)}
        </nav>
        <div className="crm-user"><CircleUserRound /><div><b>{user.name}</b><small>{user.role.replace('_', ' ')}</small></div><button onClick={logout} title="Sign out"><LogOut size={16} /></button></div>
      </aside>
      <main className="crm-main">
        <header className="crm-header">
          <div><p>SECURE CRM / {view.toUpperCase()}</p><h1>{title}</h1></div>
          <div className="crm-actions">
            {['All Leads','New Enquiries','Follow-ups','Clients'].includes(view) && <button className="crm-secondary" onClick={exportLeads}><ArrowDownToLine size={16} /> EXPORT</button>}
            {resource && canEdit && <button className="add-lead" onClick={() => openForm(resource)}><Plus size={16} /> NEW {resource === 'leads' ? 'LEAD' : resource === 'articles' ? 'INSIGHT' : resource.slice(0, -1).toUpperCase()}</button>}
            {view === 'Team Management' && user.role !== 'STAFF' && <button className="add-lead" onClick={() => openForm('team')}><Plus size={16} /> ADD TEAM MEMBER</button>}
          </div>
        </header>
        {error && <div className="crm-error" role="alert">{error}<button onClick={() => setError('')}><X size={14} /></button></div>}
        {notice && <div className="crm-notice" role="status">{notice}<button onClick={() => setNotice('')}><X size={14} /></button></div>}

        {view === 'Dashboard' && <>
          <section className="metrics">
            {[['TOTAL LEADS', overview?.total ?? '—'], ['NEW ENQUIRIES', overview?.newLeads ?? '—'], ['ACTIVE LEADS', overview?.active ?? '—'], ['CONVERTED', overview?.converted ?? '—']].map(([label, value]) => <article key={label}><p>{label}</p><strong>{value}</strong><span>{label === 'CONVERTED' ? `${overview?.conversionRate ?? 0}% conversion` : label === 'NEW ENQUIRIES' ? `${overview?.due ?? 0} follow-ups due` : 'From actual CRM records'}</span></article>)}
          </section>
          <section className="crm-grid">
            <article className="pipeline-card"><div className="card-title"><div><p>LEAD ACTIVITY</p><h2>Enquiries by month</h2></div><button className="link-button" onClick={() => setView('Reports & Analytics')}>REPORTS <ArrowRight size={14} /></button></div>
              <div className="chart"><div className="chart-line">{(overview?.monthly || []).map((month) => <i key={month.month} style={{ height: `${Math.max(4, Math.min(100, (month.total / Math.max(...overview.monthly.map((item) => item.total), 1)) * 100))}%` }} title={`${month.month}: ${month.total}`} />)}</div><div className="chart-labels">{(overview?.monthly || []).map((month) => <span key={month.month}>{month.month.slice(5)}</span>)}</div>{!overview?.monthly?.length && <p className="chart-empty">Enquiries will appear here as they arrive.</p>}</div>
            </article>
            <article className="source-card"><p>PIPELINE HEALTH</p><h2>Current conversion</h2><div className="donut"><b>{overview?.conversionRate ?? 0}%<small>CONVERTED</small></b></div><p className="crm-muted">{overview?.due ?? 0} follow-ups are due.</p></article>
          </section>
          <section className="leads-table"><div className="card-title"><div><p>RECENT ACTIVITY</p><h2>Latest leads</h2></div><button className="link-button" onClick={() => setView('All Leads')}>VIEW ALL <ArrowRight size={14} /></button></div>{renderTable(data, columns.leads, { openForm, removeRecord, showNotes, team, toggleTeam, resource:'leads', canEdit:true })}</section>
        </>}

        {['All Leads','New Enquiries','Follow-ups','Clients'].includes(view) && <>
          <div className="list-tools"><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, phone or lead ID" /></label>
            {view === 'All Leads' && <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{['NEW ENQUIRY','CONTACTED','QUALIFIED','CONSULTATION SCHEDULED','PROPOSAL SENT','CONVERTED','LOST','NURTURE'].map((status) => <option key={status}>{status}</option>)}</select>}
          </div>
          <section className="leads-table">{renderTable(items, columns.leads, { openForm, removeRecord, showNotes, team, toggleTeam, resource:'leads', canEdit:true })}{!items.length && <div className="table-empty">No records match this view yet.</div>}</section>
        </>}

        {view === 'Appointments' && <section className="leads-table">{renderTable(items, columns.appointments, { openForm, removeRecord, resource:'appointments', canEdit })}{!items.length && <div className="table-empty">No appointments yet. Add one to schedule a consultation.</div>}</section>}
        {['Services','Companies','Projects','Case Studies','Insights','Testimonials'].includes(view) && <section className="leads-table">{renderTable(items, viewColumns, { openForm, removeRecord, resource, canEdit, changeProjectStatus })}{!items.length && <div className="table-empty">No {view.toLowerCase()} added yet. Create one when the content is approved.</div>}</section>}
        {view === 'SEO' && <section className="seo-dashboard">
          <div className="seo-links"><a href="/sitemap.xml" target="_blank" rel="noreferrer">Open XML sitemap <ArrowUpRight size={15} /></a><a href="/robots.txt" target="_blank" rel="noreferrer">Open robots.txt <ArrowUpRight size={15} /></a><a href="https://search.google.com/test/rich-results" target="_blank" rel="noreferrer">Rich Results Test <ArrowUpRight size={15} /></a></div>
          <h2>Published page checks</h2><p className="crm-muted">Editorial checks only; metadata completeness does not mean Google has indexed or approved a page.</p>
          <table><thead><tr><th>PAGE</th><th>STATUS</th><th>SEO TITLE</th><th>DESCRIPTION</th><th>URL</th></tr></thead><tbody>{items.filter((item) => item._type === 'Project' ? item.publication_status === 'PUBLISHED' : item.published).map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.publication_status || 'PUBLISHED'}</td><td>{item.seo_title || 'Missing — title generated automatically'}</td><td>{item.meta_description || 'Missing — description fallback used'}</td><td>{item._type === 'Project' ? `/projects/${item.slug}` : `/services/${item.slug}`}</td></tr>)}</tbody></table>
          {!items.filter((item) => item._type === 'Project' ? item.publication_status === 'PUBLISHED' : item.published).length && <div className="table-empty">Publish a service or project to inspect its SEO settings.</div>}
        </section>}
        {view === 'Team Management' && <section className="leads-table">{renderTable(items, viewColumns, { openForm, toggleTeam, resource:'team', canEdit:user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' })}{!items.length && <div className="table-empty">No team members found.</div>}</section>}

        {view === 'Reports & Analytics' && <section className="reports">
          <div className="metrics"><article><p>LEADS</p><strong>{overview?.total ?? 0}</strong></article><article><p>ACTIVE</p><strong>{overview?.active ?? 0}</strong></article><article><p>FOLLOW-UPS DUE</p><strong>{overview?.due ?? 0}</strong></article><article><p>CONVERSION RATE</p><strong>{overview?.conversionRate ?? 0}%</strong></article></div>
          <article className="leads-table"><div className="card-title"><div><p>DATA EXPORT</p><h2>Lead report</h2></div><button className="add-lead" onClick={exportLeads}><ArrowDownToLine size={15} /> DOWNLOAD CSV</button></div><p className="crm-muted">Exports only records your account is authorized to access.</p></article>
          {user.role !== 'STAFF' && <article className="leads-table"><div className="card-title"><div><p>SECURITY & ACTIVITY</p><h2>Recent audit events</h2></div></div><table><thead><tr><th>ACTOR</th><th>ACTION</th><th>RECORD</th><th>TIME</th></tr></thead><tbody>{auditLogs.slice(0,20).map((entry) => <tr key={entry.id}><td>{entry.user_name || 'System'}</td><td>{entry.action.replaceAll('_',' ')}</td><td>{entry.entity} {entry.entity_id}</td><td>{new Date(entry.created_at).toLocaleString()}</td></tr>)}</tbody></table>{!auditLogs.length && <div className="table-empty">No audit activity yet.</div>}</article>}
        </section>}

        {view === 'Website Content' && <section className="content-tools">
          <p>Manage the public-site content from dedicated editors. New content remains unpublished until you choose to publish it.</p>
            {['Services','Companies','Projects','Case Studies','Insights','Testimonials','SEO'].map((section) => <button key={section} onClick={() => setView(section)}>{section}<ArrowRight size={16} /></button>)}
          <button onClick={() => setView('Settings')}>Homepage, contact and policy content<ArrowRight size={16} /></button>
        </section>}

        {view === 'Settings' && <div className="settings-layout">
          <form className="settings-form" onSubmit={updateSetting}>
            <p className="eyebrow">PUBLIC WEBSITE</p><h2>Company content & contact</h2>
            {['owner','phone','email','site_url','tagline','hero_title','hero_body','about_heading','about_body','privacy_text','terms_text'].map((key) => <label key={key}>{key.replaceAll('_',' ').replace(/\b\w/g,(c)=>c.toUpperCase())}{key.includes('body') || key.includes('text') || key === 'hero_title' || key === 'about_heading' ? <textarea name={key} defaultValue={settings[key] || ''} rows={key.includes('text') ? 6 : 3} /> : <input name={key} defaultValue={settings[key] || ''} />}</label>)}
            <label>Industries (one per line)<textarea name="industries" defaultValue={(() => { try { return JSON.parse(settings.industries || '[]').join('\n'); } catch { return ''; } })()} /></label>
            <button className="crm-primary">SAVE WEBSITE CONTENT</button>
          </form>
          <form className="settings-form" onSubmit={changePassword}>
            <p className="eyebrow">ACCOUNT SECURITY</p><h2>Change your password</h2>
            <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
            <label>New password (at least 12 characters)<input name="newPassword" type="password" minLength="12" autoComplete="new-password" required /></label>
            <button className="crm-primary">CHANGE PASSWORD</button>
            <p className="crm-muted">If locked out, use the server administrator's secure account recovery procedure. Public password reset is disabled.</p>
          </form>
        </div>}
      </main>

      {modal && <div className="modal-backdrop" role="dialog" aria-modal="true"><form className="crm-form-modal" encType={modal.resource === 'projects' ? 'multipart/form-data' : undefined} onSubmit={saveRecord}>
        <button type="button" className="modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={18} /></button>
        <p className="eyebrow">{modal.record ? 'UPDATE RECORD' : 'CREATE RECORD'}</p><h2>{modal.record ? 'Edit' : 'Add'} {modal.resource === 'articles' ? 'insight' : modal.resource === 'teamEdit' || modal.resource === 'team' ? 'team member' : modal.resource.slice(0,-1)}</h2>
        {fields[modal.resource].map(([key,label,type,required,options]) => <label key={key} className={type === 'hidden' ? 'hidden-field' : ''}>{label}
          {type === 'textarea' ? <textarea name={key} defaultValue={modal.initial[key] || ''} required={required} rows={4} /> :
            type === 'select' ? <select name={key} value={modal.resource === 'projects' && key === 'publication_status' ? (modal.initial.publication_status || 'DRAFT') : undefined} defaultValue={modal.resource === 'projects' && key === 'publication_status' ? undefined : modal.initial[key] || ''} onChange={modal.resource === 'projects' && key === 'publication_status' ? (event) => setModal((current) => ({ ...current, initial: { ...current.initial, publication_status: event.target.value } })) : undefined} required={required}>{key === 'assigned_to' && <option value="">Unassigned</option>}{(type === 'team' ? team.map((member) => [member.id, member.name]) : options).map((option) => Array.isArray(option) ? <option value={option[0]} key={option[0]}>{option[1]}</option> : <option key={option}>{option}</option>)}</select> :
              type === 'team' ? <select name={key} defaultValue={modal.initial[key] || ''}><option value="">Unassigned</option>{team.filter((member) => member.active).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select> :
                type === 'checkbox' ? <input type="checkbox" name={key} defaultChecked={Boolean(modal.initial[key])} /> :
                  type === 'files' ? <input name={key} type="file" accept="image/jpeg,image/png,image/webp" multiple /> :
                    type === 'file' ? <input name={key} type="file" accept="image/jpeg,image/png,image/webp" /> :
                      <input name={key} type={type} defaultValue={modal.initial[key] || ''} required={required} min={type === 'number' ? 0 : undefined} />}</label>)}
        {error && <div className="crm-error">{error}</div>}
        <button className="crm-primary" disabled={busy}>{busy ? 'SAVING…' : modal.resource === 'projects' && modal.initial.publication_status === 'PUBLISHED' ? 'PUBLISH TO WEBSITE' : 'SAVE'}</button>
      </form></div>}

      {notesLead && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="crm-form-modal notes-modal">
        <button type="button" className="modal-close" onClick={() => setNotesLead(null)} aria-label="Close"><X size={18} /></button>
        <p className="eyebrow">LEAD HISTORY / {notesLead.id}</p><h2>{notesLead.full_name}</h2>
        <div className="notes-list">{notes.map((item) => <article key={item.id}><p>{item.note}</p><small>{item.author || 'Former team member'} · {item.created_at}</small></article>)}{!notes.length && <p className="crm-muted">No internal notes yet.</p>}</div>
        <form onSubmit={addNote}><label>Add an internal note<textarea name="note" required maxLength="4000" /></label><button className="crm-primary">ADD NOTE</button></form>
      </div></div>}
    </div>
  );
}

function renderTable(rows, cols, actions) {
  const { openForm, removeRecord, showNotes, toggleTeam, resource, canEdit, changeProjectStatus } = actions;
  return <table><thead><tr>{cols.map(([key,label]) => <th key={key}>{label.toUpperCase()}</th>)}<th>ACTIONS</th></tr></thead><tbody>
    {rows.map((row) => <tr key={row.id}>{cols.map(([key]) => <td key={key}>
      {key === 'status' || key === 'publication_status' ? <span className={`status status-${String(row[key] || '').toLowerCase().replaceAll(' ','-')}`}>{row[key]}</span> :
        key === 'published' || key === 'active' ? <span className={row[key] ? 'published-yes' : 'published-no'}>{row[key] ? 'YES' : 'NO'}</span> :
          key === 'description' || key === 'quote' ? <span className="truncate">{row[key] || '—'}</span> :
            key === 'follow_up_at' || key === 'starts_at' ? (row[key] ? new Date(row[key]).toLocaleString() : '—') : (row[key] || '—')}
    </td>)}<td className="row-actions">
      {resource === 'leads' && <button title="Internal notes" onClick={() => showNotes(row)}>NOTES</button>}
      {resource === 'projects' && row.publication_status !== 'ARCHIVED' && <button title={row.publication_status === 'PUBLISHED' ? 'Unpublish project' : 'Publish project'} onClick={() => changeProjectStatus(row, row.publication_status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')}>{row.publication_status === 'PUBLISHED' ? 'UNPUBLISH' : 'PUBLISH'}</button>}
      {resource === 'projects' && row.publication_status !== 'ARCHIVED' && <button title="Archive project" onClick={() => changeProjectStatus(row, 'ARCHIVED')}>ARCHIVE</button>}
      {canEdit && row.role !== 'SUPER_ADMIN' && <button title="Edit record" onClick={() => openForm(resource, row)}>EDIT</button>}
      {resource === 'team' && row.role !== 'SUPER_ADMIN' && <button onClick={() => toggleTeam(row)}>{row.active ? 'DISABLE' : 'ENABLE'}</button>}
      {canEdit && resource !== 'team' && <button title="Delete record" onClick={() => removeRecord(resource, row)}><Trash2 size={14} /></button>}
    </td></tr>)}
  </tbody></table>;
}

export default function App() {
  const [consult, setConsult] = useState(false);
  const [crm, setCrm] = useState(() => window.location.hash === '#crm' || window.location.pathname === '/crm');
  const [servicesList, setServicesList] = useState([]);
  const [whatsAppPhone, setWhatsAppPhone] = useState('+91 7567490201');
  useEffect(() => {
    const handler = () => setCrm(window.location.hash === '#crm' || window.location.pathname === '/crm');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    api('/public/site').then((site) => {
      setServicesList(site.services);
      setWhatsAppPhone(site.settings.phone || '+91 7567490201');
    }).catch(() => {});
  }, []);
  return (
    <>
      {crm ? <CRM /> : <PublicSite onConsult={() => setConsult(true)} />}
      <ConsultationModal open={consult} onClose={() => setConsult(false)} services={servicesList} phone={whatsAppPhone} />
    </>
  );
}
