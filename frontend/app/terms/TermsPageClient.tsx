"use client";

import React, { useState } from 'react';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import Link from 'next/link';
import { useSettings } from '@/context/SettingsContext';
import { 
  ShieldCheck, 
  Search, 
  FileText, 
  Scale, 
  AlertCircle, 
  UserCheck, 
  CheckCircle2, 
  Mail, 
  Building2, 
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface Section {
  id: string;
  number: string;
  title: string;
  badge?: string;
  subsections?: { title: string; content: string }[];
  content?: string;
  points?: string[];
  note?: string;
}

export default function TermsPageClient() {
  const {
    companyName = 'BharatClap Technologies Private Limited',
    platformName = 'BharatClap',
    supportEmail = 'support@bharatclap.com',
    supportPhone = '+91 80 4567 8900',
    policiesVersion = '2026.3',
    lastUpdated = 'October 2026',
    companyAddress = 'Bengaluru, Karnataka, India'
  } = useSettings();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('1');

  const sections: Section[] = [
    {
      id: 'section-1',
      number: '1',
      title: 'ABOUT BHARATCLAP',
      badge: 'Platform Model',
      subsections: [
        {
          title: '1.1 Platform',
          content: 'BharatClap operates an online marketplace that enables customers to discover, request, schedule and book services offered by independent service providers.'
        },
        {
          title: '1.2 Independent Service Providers',
          content: 'The professionals listed on BharatClap are independent service providers. Unless expressly stated otherwise, BharatClap does not directly provide the underlying home service performed by a service provider. The service provider is responsible for performing the booked service, subject to the applicable booking terms and BharatClap\'s platform policies.'
        },
        {
          title: '1.3 Platform Role',
          content: 'BharatClap facilitates: discovery of services; service-provider listing and onboarding; booking requests; appointment scheduling; communication relating to bookings; payment collection or payment facilitation where applicable; booking notifications; customer reviews and ratings; and other platform-related services.'
        }
      ]
    },
    {
      id: 'section-2',
      number: '2',
      title: 'CUSTOMER ACCOUNT',
      badge: 'Account Terms',
      content: 'To use certain BharatClap features, you may need to create an account. You agree that:',
      points: [
        'The information you provide must be accurate and truthful;',
        'You will keep your account information continuously updated;',
        'You are strictly responsible for all activity conducted through your account;',
        'You must protect your login credentials, passwords, and authentication OTPs;',
        'You must not share authentication credentials with unauthorised persons; and',
        'You must immediately notify BharatClap if you reasonably suspect unauthorised access to your account.'
      ],
      note: 'BharatClap may require users to verify their mobile number via 6-digit SMS OTP or other identity credentials before granting access to certain services.'
    },
    {
      id: 'section-3',
      number: '3',
      title: 'ELIGIBILITY',
      badge: 'Legal Capacity',
      content: 'You must satisfy the applicable legal requirements to use BharatClap. Where required by applicable law or by the nature of a service, BharatClap may restrict certain services or features based on age (minimum 18 years or legal age of majority in India), location, eligibility, verification requirements, or other lawful conditions.'
    },
    {
      id: 'section-4',
      number: '4',
      title: 'SERVICES AND BOOKINGS',
      badge: 'Order Processing',
      content: 'Customers may browse available categories, services and service providers through the Platform. A booking may include selected service, sub-service (where applicable), service price, duration or estimated duration, customer address, requested date and time slot, applicable fees or taxes, and other booking-specific details.',
      points: [
        'A booking request does not necessarily mean that the service has been confirmed.',
        'The booking will be considered confirmed only when BharatClap communicates the applicable confirmation through the Platform or another authorised communication channel (SMS/WhatsApp/Push Notification).'
      ]
    },
    {
      id: 'section-5',
      number: '5',
      title: 'SERVICE PROVIDER AVAILABILITY',
      badge: 'Fulfillment',
      content: 'BharatClap uses reasonable commercial efforts to connect a customer with an available service provider. Availability may depend on geographical location, service area coverage, provider schedule, selected date and time, provider status, specific service requirements, and other operational factors.',
      note: 'If the selected provider becomes unavailable, BharatClap may facilitate automated reassignment to an equivalent verified partner or provide other available options, subject to applicable booking conditions.'
    },
    {
      id: 'section-6',
      number: '6',
      title: 'PRICING AND PAYMENTS',
      badge: 'Transparent Pricing',
      content: 'The applicable price displayed during booking may include the service price and any applicable fees, statutory taxes, discounts or other charges. Prices may vary based on selected service, location, service requirements, active promotional offers, additional services requested on-site, and applicable GST/taxes.',
      points: [
        'The final amount payable will be the amount communicated through the Platform at the applicable stage of the booking, subject to legitimate additional charges permitted under the applicable terms.',
        'Where online payment is available, payments are processed securely through RBI-compliant, PCI-DSS certified payment gateways.',
        'BharatClap may also support cash-on-delivery (COD) or other approved payment methods depending on the service category and location.'
      ]
    },
    {
      id: 'section-7',
      number: '7',
      title: 'ADDITIONAL SERVICES OR CHARGES',
      badge: 'On-Site Addons',
      content: 'A customer may request additional services or scope expansions during the service appointment. Any additional charge must be communicated to and accepted by the customer before the additional service is performed, where applicable. The final payable invoice may therefore differ from the initial booking estimate where the customer has requested additional work or parts.'
    },
    {
      id: 'section-8',
      number: '8',
      title: 'CANCELLATION AND RESCHEDULING',
      badge: 'Fair Policy',
      content: 'Customers may cancel or reschedule bookings subject to the applicable cancellation and rescheduling policy displayed on the Platform. Depending on the timing and circumstances of cancellation, a nominal cancellation fee may apply.',
      note: 'BharatClap may cancel or modify a booking where necessary due to provider unavailability, operational issues, safety concerns, payment failures, incorrect booking information, or service-area constraints. Customers will be immediately informed with full refund entitlement where applicable.'
    },
    {
      id: 'section-9',
      number: '9',
      title: 'SERVICE PROVIDER CONDUCT',
      badge: 'Partner Standards',
      content: 'Service providers partnered with BharatClap are independently vetted professionals required to:',
      points: [
        'Deliver services professionally and with due care;',
        'Comply with all applicable Indian laws and platform standards;',
        'Maintain courteous and respectful conduct with customers;',
        'Respect customer property, premises, and personal privacy;',
        'Provide accurate service details and transparent estimates;',
        'Adhere to mandatory occupational safety and sanitization requirements; and',
        'Comply with BharatClap\'s Partner Code of Conduct.'
      ]
    },
    {
      id: 'section-10',
      number: '10',
      title: 'CUSTOMER CONDUCT',
      badge: 'Customer Guidelines',
      content: 'Customers must treat service providers respectfully and provide a reasonably safe and appropriate work environment for service execution. Customers must strictly refrain from:',
      points: [
        'Harassing, threatening, or abusing service providers;',
        'Discriminating against service providers on any grounds;',
        'Intentionally providing false addresses or fraudulent information;',
        'Misusing the Platform or attempting unauthorized transactions;',
        'Interfering with provider operations or equipment;',
        'Using the Platform for unlawful, hazardous, or prohibited purposes; or',
        'Attempting to bypass BharatClap\'s booking or payment systems.'
      ],
      note: 'BharatClap reserves the right to suspend or permanently deactivate accounts that violate customer conduct policies.'
    },
    {
      id: 'section-11',
      number: '11',
      title: 'REVIEWS AND RATINGS',
      badge: 'Customer Feedback',
      content: 'Customers are encouraged to submit truthful ratings, reviews, and qualitative feedback regarding their service experience. Reviews must be truthful, relevant to the service rendered, based on genuine user experiences, and free from abusive, defamatory, or misleading statements. BharatClap may moderate or remove reviews that violate content policies.'
    },
    {
      id: 'section-12',
      number: '12',
      title: 'USER CONTENT',
      badge: 'Intellectual Property',
      content: 'Users may submit photos, text reviews, and other media through the Platform. You represent and warrant that all content you submit is accurate, does not infringe any third party\'s intellectual property or privacy rights, and does not contain malicious code, spyware, or illegal material.'
    },
    {
      id: 'section-13',
      number: '13',
      title: 'PERSONAL DATA AND PRIVACY',
      badge: 'DPDP Act 2023',
      content: 'BharatClap collects and processes personal information necessary to operate the marketplace, match service providers, process payments, and ensure platform security in strict accordance with the Digital Personal Data Protection (DPDP) Act, 2023.',
      points: [
        'Personal data collected includes mobile number, name, address, coordinates, and transaction history.',
        'Data is processed strictly under lawful consent and legitimate use for service execution.',
        'Refer to our comprehensive Privacy Policy for complete details on Data Principal rights and erasure requests.'
      ]
    },
    {
      id: 'section-14',
      number: '14',
      title: 'COMMUNICATIONS',
      badge: 'Multi-Channel Alerts',
      content: 'BharatClap may communicate with users through SMS, phone calls, email, WhatsApp, push notifications, and in-app updates regarding account verification, booking confirmations, provider assignment, status alerts, security notifications, invoices, and relevant promotional announcements.'
    },
    {
      id: 'section-15',
      number: '15',
      title: 'THIRD-PARTY SERVICES',
      badge: 'Integrations',
      content: 'BharatClap integrates verified third-party technology providers for payment processing, SMS/OTP gateways, mapping and geolocation services, cloud hosting, and analytics. Use of such services may be subject to the terms and privacy notices of those respective third-party providers.'
    },
    {
      id: 'section-16',
      number: '16',
      title: 'INTELLECTUAL PROPERTY',
      badge: 'Proprietary Assets',
      content: 'The BharatClap name, logo, trade dress, website layout, application software, interfaces, graphics, source code, and published content are the exclusive proprietary property of BharatClap Technologies Private Limited and are protected by applicable trademark, copyright, and intellectual property laws.'
    },
    {
      id: 'section-17',
      number: '17',
      title: 'PLATFORM AVAILABILITY',
      badge: 'Uptime & SLAs',
      content: 'While BharatClap uses industry-standard cloud infrastructure to maximize platform uptime, temporary disruptions may occasionally occur due to scheduled maintenance, telecommunications outages, third-party API issues, cyber incidents, or force majeure events outside our reasonable control.'
    },
    {
      id: 'section-18',
      number: '18',
      title: 'ACCOUNT SUSPENSION OR TERMINATION',
      badge: 'Security Controls',
      content: 'BharatClap may suspend, restrict, or terminate account access if a user violates these Terms, engages in suspected fraud or payment abuse, displays abusive behavior towards service providers, or poses a security or legal risk to the platform. Users may delete their accounts at any time via the profile settings.'
    },
    {
      id: 'section-19',
      number: '19',
      title: 'LIMITATION OF LIABILITY',
      badge: 'Legal Disclaimer',
      content: 'To the maximum extent permitted by applicable Indian law, BharatClap operates as an intermediary platform connecting users with independent third-party service providers. Nothing in these Terms excludes or limits liability that cannot legally be limited under the Consumer Protection Act, 2019 or other applicable Indian statutes.'
    },
    {
      id: 'section-20',
      number: '20',
      title: 'INDEMNIFICATION',
      badge: 'Mutual Indemnity',
      content: 'To the extent permitted by law, you agree to indemnify and hold harmless BharatClap, its directors, officers, employees, and agents from any third-party claims, liabilities, damages, or costs arising out of your willful breach of these Terms or infringement of third-party rights.'
    },
    {
      id: 'section-21',
      number: '21',
      title: 'CHANGES TO THESE TERMS',
      badge: 'Version Updates',
      content: 'BharatClap reserves the right to amend these Terms from time to time. Revised terms will be posted with an updated \"Last Updated\" timestamp. Continued use of the Platform after the effective date of updated Terms constitutes acceptance of the revised Terms.'
    },
    {
      id: 'section-22',
      number: '22',
      title: 'GOVERNING LAW & JURISDICTION',
      badge: 'India Jurisdiction',
      content: 'These Terms and any dispute or claim arising out of or in connection with them shall be governed by and construed in accordance with the laws of India. Subject to the arbitration provisions, courts in Bengaluru, Karnataka shall have exclusive jurisdiction over any disputes.'
    },
    {
      id: 'section-23',
      number: '23',
      title: 'GRIEVANCE REDRESSAL',
      badge: 'Statutory Grievance',
      content: 'In accordance with the Information Technology Act, 2000 and the Consumer Protection (E-Commerce) Rules, 2020, users may address grievances, inquiries, or complaints to our designated Grievance Officer:',
      points: [
        'Company: ' + companyName,
        'Platform: ' + platformName,
        'Support Email: ' + supportEmail,
        'Support Helpline: ' + supportPhone,
        'Grievance Officer: Legal & Grievance Department',
        'Registered Office: ' + companyAddress
      ],
      note: 'All formal consumer complaints and statutory notices are acknowledged within 48 hours and resolved in accordance with applicable statutory timelines.'
    }
  ];

  const filteredSections = sections.filter(sec => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = sec.title.toLowerCase().includes(q);
    const contentMatch = sec.content?.toLowerCase().includes(q);
    const pointsMatch = sec.points?.some(p => p.toLowerCase().includes(q));
    const subMatch = sec.subsections?.some(s => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q));
    return titleMatch || contentMatch || pointsMatch || subMatch;
  });

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      <Navbar />

      {/* Hero Banner */}
      <section className="bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#1D2B83] text-white py-14 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_50%)] pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md text-emerald-300 text-xs font-semibold rounded-full border border-white/15">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Official Legal Agreement
            </span>
            <span className="px-3 py-1 bg-white/10 text-slate-300 text-xs font-mono rounded-full border border-white/10">
              Version {policiesVersion}
            </span>
            <span className="px-3 py-1 bg-white/10 text-slate-300 text-xs rounded-full border border-white/10">
              Last Updated: {lastUpdated}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
            Terms &amp; Conditions
          </h1>
          <p className="max-w-3xl text-sm sm:text-base text-slate-300 leading-relaxed">
            These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to and use of the BharatClap website, mobile applications, and related services (collectively, the &quot;Platform&quot;). BharatClap connects customers with independent service providers for professional home and personal services.
          </p>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across all 23 terms sections (e.g. cancellation, payment, liability)..."
              className="w-full pl-12 pr-4 py-3 bg-white rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D2B83] shadow-sm text-slate-800 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 px-2 py-1 rounded-md"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Desktop Table of Contents Sidebar */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-24 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm max-h-[calc(100vh-120px)] overflow-y-auto">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <FileText className="w-4 h-4 text-[#1D2B83]" />
              <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                Table of Contents (23 Sections)
              </h2>
            </div>
            <nav className="space-y-1 text-xs">
              {sections.map((sec) => (
                <a
                  key={sec.id}
                  href={'#' + sec.id}
                  onClick={() => setActiveSection(sec.number)}
                  className={'flex items-center justify-between p-2 rounded-xl transition-colors ' + (activeSection === sec.number ? 'bg-indigo-50 text-[#1D2B83] font-bold' : 'text-slate-600 hover:bg-slate-50')}
                >
                  <span className="truncate pr-2">
                    <span className="font-mono text-slate-400 mr-2">{sec.number}.</span>
                    {sec.title}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                </a>
              ))}
            </nav>

            <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <Building2 className="w-4 h-4 text-[#1D2B83]" />
                <span>Grievance Helpdesk</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Need legal clarification? Reach out directly to{' '}
                <a href={'mailto:' + supportEmail} className="text-[#1D2B83] font-semibold underline">
                  {supportEmail}
                </a>
              </p>
            </div>
          </aside>

          {/* Main Sections Column */}
          <div className="lg:col-span-8 space-y-6">
            {filteredSections.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-200">
                <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h3 className="font-bold text-slate-800 text-base mb-1">No matching terms found</h3>
                <p className="text-xs text-slate-500">Try searching with a different keyword like &quot;refund&quot;, &quot;booking&quot;, or &quot;provider&quot;.</p>
              </div>
            ) : (
              filteredSections.map((sec) => (
                <section
                  key={sec.id}
                  id={sec.id}
                  className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm transition-all hover:border-slate-300 scroll-mt-24 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-[#EEF2FF] text-[#1D2B83] font-mono font-bold text-sm flex items-center justify-center flex-shrink-0">
                        {sec.number}
                      </span>
                      <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        {sec.title}
                      </h2>
                    </div>
                    {sec.badge && (
                      <span className="hidden sm:inline-block px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-lg uppercase tracking-wider">
                        {sec.badge}
                      </span>
                    )}
                  </div>

                  {sec.content && (
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                      {sec.content}
                    </p>
                  )}

                  {sec.subsections && (
                    <div className="space-y-3 pt-1">
                      {sec.subsections.map((sub, sIdx) => (
                        <div key={sIdx} className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 space-y-1.5">
                          <h3 className="font-bold text-xs sm:text-sm text-[#1D2B83]">{sub.title}</h3>
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">{sub.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {sec.points && (
                    <ul className="space-y-2 pt-1 text-xs sm:text-sm text-slate-600">
                      {sec.points.map((pt, pIdx) => (
                        <li key={pIdx} className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-[#1D2B83] flex-shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {sec.note && (
                    <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/60 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span>{sec.note}</span>
                    </div>
                  )}
                </section>
              ))
            )}

            {/* Bottom Callout & Quick Link to Privacy */}
            <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="font-bold text-sm sm:text-base">Review Our Privacy &amp; Data Protection Policy</h4>
                <p className="text-xs text-slate-300">Understand how your personal data is handled under India&apos;s DPDP Act, 2023.</p>
              </div>
              <Link
                href="/privacy"
                className="px-5 py-2.5 bg-white text-slate-900 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors flex-shrink-0 shadow-sm"
              >
                Read Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
