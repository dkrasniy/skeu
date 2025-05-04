import { BentoCard } from '../components/bento-card'
import { Button } from '../components/button'
import { Container } from '../components/container'
import { Footer } from '../components/footer'
import { Gradient } from '../components/gradient'
import { Keyboard } from '../components/keyboard'
import { Link } from '../components/link'
import { LinkedAvatars } from '../components/linked-avatars'
import { LogoCloud } from '../components/logo-cloud'
import { LogoCluster } from '../components/logo-cluster'
import { LogoTimeline } from '../components/logo-timeline'
import { Map } from '../components/map'
import { Navbar } from '../components/navbar'
import { Screenshot } from '../components/screenshot'
import { Testimonials } from '../components/testimonials'
import { Heading, Subheading } from '../components/text'
import { ChevronRightIcon, CloudArrowUpIcon } from '@heroicons/react/16/solid'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  description:
    'Create beautiful device mockups and screenshots with custom backgrounds and frames. Perfect for presentations and marketing materials.',
}

// skeu helps you create beautiful mockups and screenshots of whatever you are designing and working on.. 
// create custom canvas, crop, change background and more and by draging and dropping in your image

function Hero() {
  return (
    <div className="relative">
      <Gradient className="absolute inset-2 bottom-0 rounded-4xl ring-1 ring-black/5 ring-inset" />
      <Container className="relative">
        <Navbar />
        <div className="pt-16 pb-24 sm:pt-24 sm:pb-32 md:pt-32 md:pb-48">
          <h1 className="font-display text-3xl/[0.9] font-medium tracking-tight text-balance text-gray-950 sm:text-4xl/[0.8] md:text-5xl/[0.8]">
            Create stunning device mockups in seconds
          </h1>
          <p className="mt-8 max-w-lg text-xl/7 font-medium text-gray-950/75 sm:text-2xl/8">
            Transform your screenshots into professional presentations with beautiful device frames, custom backgrounds, and perfect lighting.
          </p>
          <div className="mt-12 flex flex-col gap-x-6 gap-y-4 sm:flex-row">
            <Button href="#">Get started</Button>
            <Button variant="secondary" href="/pricing">
              See pricing
            </Button>
          </div>
          
          {/* Drag and Drop Area */}
          <div className="mt-16">
            <div className="relative rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-12 min-h-40 text-center transition-colors hover:border-gray-300 hover:bg-gray-50">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                 <CloudArrowUpIcon className="h-8 w-8 text-gray-400 mx-auto" />
                  <p className="mt-4 text-lg font-medium text-gray-900">Drag and drop your screenshot here</p>
                  <p className="mt-2 text-sm text-gray-500">or click to browse files</p>
                </div>
              </div>
              <input
                type="file"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                accept="image/*"
              />
            </div>
            <p className="mt-4 text-center text-sm text-gray-500">
              Supports PNG, JPG, and WebP up to 10MB
            </p>
          </div>
        </div>
      </Container>
    </div>
  )
}

function FeatureSection() {
  return (
    <div className="overflow-hidden">
      <Container className="pb-24">
        <Heading as="h2" className="max-w-3xl">
          Drag, drop, and transform your screenshots instantly
        </Heading>
        <Screenshot
          width={1216}
          height={768}
          src="/screenshots/app.png"
          className="mt-16 h-[36rem] sm:h-auto sm:w-[76rem]"
        />
      </Container>
    </div>
  )
}

function BentoSection() {
  return (
    <Container>
      <Subheading>Features</Subheading>
      <Heading as="h3" className="mt-2 max-w-3xl">
        Everything you need for perfect mockups
      </Heading>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-16 lg:grid-cols-6 lg:grid-rows-2">
        <BentoCard
          eyebrow="Device Frames"
          title="Professional device frames"
          description="Choose from a wide selection of device frames including MacBooks, iPhones, iPads, and more. Perfect for showcasing your work."
          graphic={
            <div className="h-80 bg-[url(/screenshots/profile.png)] bg-[size:1000px_560px] bg-[left_-109px_top_-112px] bg-no-repeat" />
          }
          fade={['bottom']}
          className="max-lg:rounded-t-4xl lg:col-span-3 lg:rounded-tl-4xl"
        />
        <BentoCard
          eyebrow="Backgrounds"
          title="Custom backgrounds"
          description="Add beautiful gradients, patterns, or upload your own background to make your mockups stand out."
          graphic={
            <div className="absolute inset-0 bg-[url(/screenshots/competitors.png)] bg-[size:1100px_650px] bg-[left_-38px_top_-73px] bg-no-repeat" />
          }
          fade={['bottom']}
          className="lg:col-span-3 lg:rounded-tr-4xl"
        />
        <BentoCard
          eyebrow="Lighting"
          title="Perfect lighting effects"
          description="Add realistic shadows, reflections, and lighting effects to make your mockups look professional."
          graphic={
            <div className="flex size-full pt-10 pl-10">
              <Keyboard highlighted={['LeftCommand', 'LeftShift', 'D']} />
            </div>
          }
          className="lg:col-span-2 lg:rounded-bl-4xl"
        />
        <BentoCard
          eyebrow="Export"
          title="High-quality exports"
          description="Export your mockups in multiple formats and resolutions, perfect for presentations and marketing materials."
          graphic={<LogoCluster />}
          className="lg:col-span-2"
        />
        <BentoCard
          eyebrow="Templates"
          title="Ready-to-use templates"
          description="Start with professionally designed templates for common use cases like app showcases and website presentations."
          graphic={<Map />}
          className="max-lg:rounded-b-4xl lg:col-span-2 lg:rounded-br-4xl"
        />
      </div>
    </Container>
  )
}

function DarkBentoSection() {
  return (
    <div className="mx-2 mt-2 rounded-4xl bg-gray-900 py-32">
      <Container>
        <Subheading dark>Workflow</Subheading>
        <Heading as="h3" dark className="mt-2 max-w-3xl">
          Streamline your mockup creation process
        </Heading>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-16 lg:grid-cols-6 lg:grid-rows-2">
          <BentoCard
            dark
            eyebrow="Upload"
            title="Simple drag and drop"
            description="Just drag and drop your screenshots to get started. We support all common image formats."
            graphic={
              <div className="h-80 bg-[url(/screenshots/networking.png)] bg-[size:851px_344px] bg-no-repeat" />
            }
            fade={['top']}
            className="max-lg:rounded-t-4xl lg:col-span-4 lg:rounded-tl-4xl"
          />
          <BentoCard
            dark
            eyebrow="Customize"
            title="Endless customization"
            description="Adjust colors, shadows, and effects to match your brand and style perfectly."
            graphic={<LogoTimeline />}
            className="z-10 overflow-visible! lg:col-span-2 lg:rounded-tr-4xl"
          />
          <BentoCard
            dark
            eyebrow="Share"
            title="Easy sharing"
            description="Share your mockups directly to social media or export them for your presentations."
            graphic={<LinkedAvatars />}
            className="lg:col-span-2 lg:rounded-bl-4xl"
          />
          <BentoCard
            dark
            eyebrow="Batch"
            title="Batch processing"
            description="Create multiple mockups at once with our batch processing feature. Perfect for app stores and marketing campaigns."
            graphic={
              <div className="h-80 bg-[url(/screenshots/engagement.png)] bg-[size:851px_344px] bg-no-repeat" />
            }
            fade={['top']}
            className="max-lg:rounded-b-4xl lg:col-span-4 lg:rounded-br-4xl"
          />
        </div>
      </Container>
    </div>
  )
}

export default function Home() {
  return (
    <div className="overflow-hidden">
      <Hero />
      <main>
        <Container className="mt-10">
          <LogoCloud />
        </Container>
        <div className="bg-linear-to-b from-white from-50% to-gray-100 py-32">
          <FeatureSection />
          <BentoSection />
        </div>
        <DarkBentoSection />
      </main>
      <Testimonials />
      <Footer />
    </div>
  )
}
