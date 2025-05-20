import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface BlogPostProps {
  title: string;
  date: string;
  content: JSX.Element;
  relatedArticles: { title: string; path: string }[];
}

export default function BlogPost({ title, date, content, relatedArticles }: BlogPostProps) {
  return (
    <Layout>
      <Navbar />
      <div className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <section className="mb-12 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{title}</h1>
            <p className="text-muted-foreground">Published on {date}</p>
          </section>

          {/* Content and Sidebar */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 bg-background rounded-xl p-8 shadow-md">
              <article className="prose prose-gray dark:prose-invert max-w-none">
                {content}
              </article>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-background rounded-xl p-6 shadow-md sticky top-24">
                <h3 className="text-xl font-semibold mb-4 text-bank-gold">Related Articles</h3>
                <ul className="space-y-3">
                  {relatedArticles.map((article) => (
                    <li key={article.path}>
                      <Link
                        to={article.path}
                        className="text-muted-foreground hover:text-bank-gold transition-colors"
                      >
                        {article.title}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className="mt-6 w-full bg-bank-gold hover:bg-bank-gold/90 text-bank-dark-text"
                >
                  <Link to="/signup">
                    Open an Account <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </Layout>
  );
}