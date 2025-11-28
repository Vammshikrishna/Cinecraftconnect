
import { useState, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  title: string;
  component: ReactNode;
  validation?: () => boolean;
}

interface MultiStepFormProps {
  steps: Step[];
  onComplete: () => void;
  className?: string;
}

export const MultiStepForm = ({ steps, onComplete, className }: MultiStepFormProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    const currentValidation = steps[currentStep].validation;
    if (currentValidation && !currentValidation()) {
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className={cn("max-w-2xl mx-auto", className)}>
      {/* Progress Indicator */}
      <div className="mb-8">
        {/* Mobile Step Counter */}
        <div className="sm:hidden mb-4 text-center">
          <p className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </p>
          <p className="text-base font-semibold text-foreground">
            {steps[currentStep].title}
          </p>
        </div>

        <div className="flex items-center justify-between mb-4 gap-2">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full text-sm font-medium transition-colors mb-2",
                  index <= currentStep
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {index + 1}
              </div>
              <span className={cn(
                "text-xs md:text-sm font-medium text-center transition-colors hidden sm:block",
                index <= currentStep ? "text-foreground" : "text-muted-foreground"
              )}>
                {step.title}
              </span>
            </div>
          ))}
        </div>
        <div className="relative h-2">
          <div className="absolute top-0 left-0 h-full bg-muted rounded-full w-full"></div>
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Step Content */}
      <div className="mb-8">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4 md:mb-6 hidden sm:block">
          {steps[currentStep].title}
        </h2>
        {steps[currentStep].component}
      </div>

      {/* Navigation */}
      <div className="flex justify-between gap-3">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 0}
          className="flex items-center"
        >
          <ChevronLeft className="mr-1 md:mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
          <span className="sm:hidden">Back</span>
        </Button>

        <Button
          onClick={nextStep}
          className="flex items-center bg-primary hover:bg-primary/90"
        >
          {currentStep === steps.length - 1 ? 'Complete' : 'Next'}
          {currentStep < steps.length - 1 && <ChevronRight className="ml-1 md:ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
