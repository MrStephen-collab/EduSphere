import Link from "next/link";
import { Lock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

/**
 * The page a school lands on when its plan does not include what it asked for.
 *
 * Shown instead of a crash or an empty dashboard: the feature is named, the
 * reason is the plan rather than a fault, and the way out is one click away.
 */
export function PlanRequiredCard({
  feature,
  description,
  href,
  action = "View plans",
}: {
  feature: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
          {feature} is not in your plan
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {href ? (
          <Link className={buttonVariants()} href={href}>
            {action}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
